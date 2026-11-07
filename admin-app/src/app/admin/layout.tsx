import { auth } from "@/auth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { db } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // 侧边栏待办角标：未处理的意见反馈
  const pendingFeedback = session?.user ? await db.feedback.count({ where: { handled: false } }).catch(() => 0) : 0;

  return (
    <div className="admin-shell">
      <AdminSidebar
        operatorName={session?.user?.name ?? "运营"}
        role={session?.user?.role}
        badges={{ "/admin/feedback": pendingFeedback }}
      />
      <main className="admin-main">{children}</main>
    </div>
  );
}
