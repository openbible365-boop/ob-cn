import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Primitives";
import { Pagination } from "@/components/Pagination";
import { CreateOperatorControl } from "@/components/CreateOperatorControl";
import { ResetPasswordControl } from "@/components/ResetPasswordControl";
import { formatDate, formatDateTime } from "@/lib/format";

const OPERATOR_COLUMNS: Column[] = [
  { key: "username", label: "用户名", width: "1fr" },
  { key: "name", label: "姓名", width: "1fr" },
  { key: "role", label: "角色", width: "120px" },
  { key: "created", label: "创建时间", width: "120px" },
  { key: "ops", label: "操作", width: "160px" },
];

const LOG_COLUMNS: Column[] = [
  { key: "time", label: "时间", width: "140px" },
  { key: "operator", label: "操作人", width: "120px" },
  { key: "detail", label: "操作详情", width: "1.6fr" },
  { key: "target", label: "对象", width: "160px" },
];

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "超级管理员", MODERATOR: "内容审核员" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  // 审计日志只增不减，原先固定取最近 100 条、无法回溯更早记录，改为分页。
  const [operators, logs, logTotal] = await Promise.all([
    db.operator.findMany({ orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({
      include: { operator: true },
      orderBy: { createdAt: "desc" },
      ...pageQuery(page),
    }),
    db.auditLog.count(),
  ]);
  const info = pageInfo(page, logTotal);

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
        <DataTable columns={OPERATOR_COLUMNS} label="运营账号列表">
          <DataTable.Head />
          {operators.map((op) => (
            <DataTable.Row key={op.id}>
              <DataTable.Cell truncate title={op.username}>
                <strong>{op.username}</strong>
              </DataTable.Cell>
              <DataTable.Cell truncate title={op.name}>{op.name}</DataTable.Cell>
              <DataTable.Cell>
                <Badge tone={op.role === "SUPER_ADMIN" ? "warn" : "info"}>{ROLE_LABEL[op.role]}</Badge>
              </DataTable.Cell>
              <DataTable.Cell>{formatDate(op.createdAt)}</DataTable.Cell>
              <DataTable.Cell>
                <div className="row-actions"><ResetPasswordControl operatorId={op.id} /></div>
              </DataTable.Cell>
            </DataTable.Row>
          ))}
          {operators.length === 0 && (
            <EmptyState title="暂无运营账号" hint="点击右上角「新建运营账号」添加第一个账号" />
          )}
        </DataTable>
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>操作日志 · 最近 {logs.length} 条</div>
        <DataTable columns={LOG_COLUMNS} label="操作日志">
          <DataTable.Head />
          {logs.map((l) => (
            <DataTable.Row key={l.id}>
              <DataTable.Cell>{formatDateTime(l.createdAt)}</DataTable.Cell>
              <DataTable.Cell truncate title={l.operator.name}>
                <strong>{l.operator.name}</strong>
              </DataTable.Cell>
              <DataTable.Cell truncate title={`${l.action} · ${l.detail}`}>
                <strong>{l.action}</strong> · {l.detail}
              </DataTable.Cell>
              <DataTable.Cell truncate>{l.targetType} #{l.targetId.slice(-6)}</DataTable.Cell>
            </DataTable.Row>
          ))}
          {logs.length === 0 && (
            <EmptyState title="暂无操作记录" hint="运营在后台的每一次写操作都会记录在这里，便于追溯" />
          )}
        </DataTable>

        <Pagination info={info} basePath="/admin/audit" params={{}} />

        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
          所有写操作留痕（操作人 / 时间 / 对象 / 详情），不可篡改。
        </div>
      </div>
    </>
  );
}
