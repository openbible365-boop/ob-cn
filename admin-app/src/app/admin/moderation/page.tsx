import Link from "next/link";
import { db } from "@/lib/db";
import { approveReport, removeReportedContent, hideReportedContent, banReportedUser, muteReportedUser } from "@/lib/actions/moderation";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const LEVEL_LABEL: Record<string, string> = { BLOCK: "拦截", REVIEW: "待审", LOG: "仅记录" };
const LEVEL_PILL: Record<string, string> = { BLOCK: "pill-pink", REVIEW: "pill-orange", LOG: "pill-muted" };

const TIER_META = [
  { level: "BLOCK" as const, label: "拦截级词条", dot: "var(--pink)" },
  { level: "REVIEW" as const, label: "待审级词条", dot: "var(--orange)" },
  { level: "LOG" as const, label: "仅记录词条", dot: "var(--line)" },
];

export default async function ModerationPage() {
  const [wordCounts, reports] = await Promise.all([
    db.sensitiveWord.groupBy({ by: ["level"], _count: { level: true } }),
    db.report.findMany({
      where: { status: "PENDING" },
      include: { post: true, community: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
        {TIER_META.map((t) => (
          <div key={t.level} className="card" style={{ borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, background: t.dot, borderRadius: 100 }} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{t.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{countByLevel[t.level] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>举报审核队列 · {reports.length} 条待处理</div>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.6fr 130px 130px 90px 260px" }}>
          <div>被举报内容</div><div>所在社群</div><div>举报原因</div><div>命中级别</div><div>操作</div>
        </div>
        {reports.map((r) => (
          <div key={r.id} className="admin-table-row" style={{ gridTemplateColumns: "1.6fr 130px 130px 90px 260px" }}>
            <div style={{ fontWeight: 600, color: "var(--body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.contentSnapshot}
            </div>
            <div style={{ fontWeight: 700 }}>{r.community.name}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{r.reason}</div>
            <div><span className={`pill ${LEVEL_PILL[r.hitLevel]}`}>{LEVEL_LABEL[r.hitLevel]}</span></div>
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
          </div>
        ))}
        {reports.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: "var(--body)" }}>暂无待处理举报</div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
          所有写操作留痕（操作人 / 时间 / 对象 / 前后值），可在「权限与审计」中查看。
        </div>
      </div>
    </>
  );
}
