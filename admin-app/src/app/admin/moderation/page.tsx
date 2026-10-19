import Link from "next/link";
import { db } from "@/lib/db";
import { approveReport, removeReportedContent, hideReportedContent, banReportedUser, muteReportedUser } from "@/lib/actions/moderation";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, Card, Stat, type Tone } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";

const LEVEL_LABEL: Record<string, string> = { BLOCK: "拦截", REVIEW: "待审", LOG: "仅记录" };
// 语义映射：拦截=错误级，待审=告警级，仅记录=中性
const LEVEL_TONE: Record<string, Tone> = { BLOCK: "err", REVIEW: "warn", LOG: "neutral" };

const REPORT_COLUMNS: Column[] = [
  { key: "content", label: "被举报内容", width: "1.6fr" },
  { key: "community", label: "所在社群", width: "130px" },
  { key: "reason", label: "举报原因", width: "150px" },
  { key: "level", label: "命中级别", width: "90px" },
  { key: "ops", label: "操作", width: "260px" },
];

const TIER_META = [
  { level: "BLOCK" as const, label: "拦截级词条", tone: "err" as Tone },
  { level: "REVIEW" as const, label: "待审级词条", tone: "warn" as Tone },
  { level: "LOG" as const, label: "仅记录词条", tone: undefined },
];

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const reportWhere = { status: "PENDING" as const };
  const [wordCounts, reports, total] = await Promise.all([
    db.sensitiveWord.groupBy({ by: ["level"], _count: { level: true } }),
    db.report.findMany({
      where: reportWhere,
      include: { post: true, community: true, reporter: true },
      orderBy: { createdAt: "asc" },
      ...pageQuery(page),
    }),
    db.report.count({ where: reportWhere }),
  ]);
  const info = pageInfo(page, total);

  const countByLevel: Record<string, number> = {};
  for (const row of wordCounts) countByLevel[row.level] = row._count.level;

  return (
    <>
      <div className="admin-header">
        <div className="title">内容审核</div>
        <div className="meta">举报处理 SLA ≤ 24h · 结果反馈举报人</div>
        <div style={{ flex: 1 }} />
        <Link
          href="/admin/content#words"
          style={{ display: "flex", alignItems: "center", height: 32, padding: "0 14px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 12, fontWeight: 700 }}
        >
          敏感词库
        </Link>
        <Link
          href="/admin/audit"
          style={{ display: "flex", alignItems: "center", height: 32, padding: "0 14px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 12, fontWeight: 700 }}
        >
          操作日志
        </Link>
      </div>

      <div className="stat-grid">
        {TIER_META.map((t) => (
          <Card key={t.level}>
            <Stat label={t.label} value={countByLevel[t.level] ?? 0} tone={t.tone} />
          </Card>
        ))}
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>举报审核队列 · {reports.length} 条待处理</div>
        <DataTable columns={REPORT_COLUMNS} label="举报审核队列">
        <DataTable.Head />
        {reports.map((r) => (
          <DataTable.Row key={r.id} tone={LEVEL_TONE[r.hitLevel] === "err" ? "err" : LEVEL_TONE[r.hitLevel] === "warn" ? "warn" : undefined}>
            <DataTable.Cell truncate title={r.contentSnapshot}>{r.contentSnapshot}</DataTable.Cell>
            <DataTable.Cell truncate title={r.community.name}><strong>{r.community.name}</strong></DataTable.Cell>
            <DataTable.Cell truncate title={r.reason}>
              {r.reason}
              {r.reporter && <small className="cell-sub">举报人：{r.reporter.name}</small>}
            </DataTable.Cell>
            <DataTable.Cell>
              <Badge tone={LEVEL_TONE[r.hitLevel]}>{LEVEL_LABEL[r.hitLevel]}</Badge>
            </DataTable.Cell>
            <DataTable.Cell>
            <div className="row-actions">
              <form action={removeReportedContent}>
                <input type="hidden" name="reportId" value={r.id} />
                <ConfirmSubmitButton className="action-pink" confirmMessage="确定要删除/下架该内容吗？">
                  {r.post ? "删除" : "强制下架"}
                </ConfirmSubmitButton>
              </form>
              {r.post && (
                <form action={hideReportedContent}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button type="submit" className="action-body">屏蔽</button>
                </form>
              )}
              <form action={approveReport}>
                <input type="hidden" name="reportId" value={r.id} />
                <button type="submit" className="action-purple">通过</button>
              </form>
              {r.post && (
                <>
                  <form action={banReportedUser}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <ConfirmSubmitButton className="action-pink" confirmMessage="确定要封禁发布者吗？">封禁用户</ConfirmSubmitButton>
                  </form>
                  <form action={muteReportedUser}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <button type="submit" className="action-orange">禁言 7 天</button>
                  </form>
                </>
              )}
            </div>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
        {reports.length === 0 && (
          <EmptyState title="暂无待处理举报" hint="用户提交举报后会出现在这里，处理 SLA ≤ 24h" />
        )}
        </DataTable>

        <Pagination info={info} basePath="/admin/moderation" params={{}} />

        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
          所有写操作留痕（操作人 / 时间 / 对象 / 前后值），可在「权限与审计」中查看。
        </div>
      </div>
    </>
  );
}
