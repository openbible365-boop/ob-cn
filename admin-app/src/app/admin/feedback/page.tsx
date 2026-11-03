import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 用户意见反馈：App 端表单提交的留言在这里查看与处理
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

async function setHandled(formData: FormData) {
  "use server";
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "MODERATOR") return;
  const id = String(formData.get("id") ?? "");
  const handled = formData.get("handled") === "1";
  if (!id) return;
  await db.feedback.update({ where: { id }, data: { handled } });
  revalidatePath("/admin/feedback");
}

export default async function FeedbackManagementPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "MODERATOR") redirect("/admin/dashboard");

  const items = await db.feedback.findMany({
    orderBy: [{ handled: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const pending = items.filter((item) => !item.handled).length;

  return (
    <>
      <div className="admin-header">
        <div className="title">意见反馈</div>
        <div className="meta">{pending} 条待处理 · 共 {items.length} 条</div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        {items.length === 0 ? (
          <p style={{ color: "var(--muted)", padding: "8px 0" }}>还没有收到留言。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>时间</th>
                <th style={{ width: 180 }}>用户 / 联系方式</th>
                <th>留言</th>
                <th style={{ width: 96 }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={item.handled ? { opacity: 0.55 } : undefined}>
                  <td>{dateFormat.format(item.createdAt)}</td>
                  <td>
                    <div>{item.userName ?? "匿名用户"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {item.contact || item.userEmail || "未留联系方式"}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.content}</td>
                  <td className="row-actions">
                    <form action={setHandled}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="handled" value={item.handled ? "0" : "1"} />
                      <button className={item.handled ? "action-body" : "action-orange"} type="submit">
                        {item.handled ? "重开" : "标记已处理"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
