import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CreateOperatorControl } from "@/components/CreateOperatorControl";
import { ResetPasswordControl } from "@/components/ResetPasswordControl";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "超级管理员", MODERATOR: "内容审核员" };

export default async function AuditPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  const [operators, logs] = await Promise.all([
    db.operator.findMany({ orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({
      include: { operator: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div className="title">权限与审计</div>
      </div>

      <div className="card" style={{ padding: "16px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>运营账号 · {operators.length} 个</div>
          <CreateOperatorControl />
        </div>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1fr 1fr 130px 140px 160px" }}>
          <div>用户名</div><div>姓名</div><div>角色</div><div>创建时间</div><div>操作</div>
        </div>
        {operators.map((op) => (
          <div key={op.id} className="admin-table-row" style={{ gridTemplateColumns: "1fr 1fr 130px 140px 160px" }}>
            <div style={{ fontWeight: 700 }}>{op.username}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{op.name}</div>
            <div><span className={`pill ${op.role === "SUPER_ADMIN" ? "pill-yellow" : "pill-purple"}`}>{ROLE_LABEL[op.role]}</span></div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{op.createdAt.toISOString().slice(0, 10)}</div>
            <div className="row-actions"><ResetPasswordControl operatorId={op.id} /></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>操作日志 · 最近 {logs.length} 条</div>
        <div className="admin-table-head" style={{ gridTemplateColumns: "140px 130px 1.6fr 160px" }}>
          <div>时间</div><div>操作人</div><div>操作详情</div><div>对象</div>
        </div>
        {logs.map((l) => (
          <div key={l.id} className="admin-table-row" style={{ gridTemplateColumns: "140px 130px 1.6fr 160px" }}>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div>
            <div style={{ fontWeight: 700 }}>{l.operator.name}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>
              <span style={{ color: "var(--ink)", fontWeight: 800 }}>{l.action}</span> · {l.detail}
            </div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{l.targetType} #{l.targetId.slice(-6)}</div>
          </div>
        ))}
        {logs.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: "var(--body)" }}>暂无操作记录</div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
          所有写操作留痕（操作人 / 时间 / 对象 / 详情），不可篡改。
        </div>
      </div>
    </>
  );
}
