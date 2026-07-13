import { db } from "@/lib/db";
import { formatCompactNumber, formatDate } from "@/lib/format";

const MODULE_BARS = [
  { key: "bibleReadingPct", label: "读经", color: "var(--yellow)" },
  { key: "huiduPct", label: "慧读", color: "var(--purple)" },
  { key: "communityPct", label: "社群", color: "var(--orange)" },
  { key: "annotationPct", label: "注释", color: "var(--body)" },
] as const;

export default async function DashboardPage() {
  const latest = await db.dailyMetric.findFirst({ orderBy: { date: "desc" } });

  if (!latest) {
    return (
      <div className="admin-header">
        <div className="title">数据看板</div>
        <div className="meta">暂无数据快照，请先运行 seed 脚本。</div>
      </div>
    );
  }

  const weekAgoDate = new Date(latest.date);
  weekAgoDate.setUTCDate(weekAgoDate.getUTCDate() - 7);
  const weekAgo = await db.dailyMetric.findUnique({ where: { date: weekAgoDate } });
  const dauDeltaPct = weekAgo ? ((latest.dau - weekAgo.dau) / weekAgo.dau) * 100 : null;

  const [ranking, hotTopics] = await Promise.all([
    db.community.findMany({
      where: { status: "ACTIVE" },
      orderBy: { dailyActivity: "desc" },
      take: 4,
    }),
    db.hotTopic.findMany({ where: { date: latest.date }, orderBy: { rank: "asc" } }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div className="title">数据看板</div>
        <div className="meta">数据 T+1 · 更新于 {formatDate(latest.date)} 06:00</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>DAU（双端）</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{latest.dau.toLocaleString()}</div>
          {dauDeltaPct !== null && (
            <div style={{ fontSize: 11, fontWeight: 700, color: dauDeltaPct >= 0 ? "var(--purple)" : "var(--pink)" }}>
              {dauDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(dauDeltaPct).toFixed(1)}% 周环比
            </div>
          )}
        </div>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>MAU</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{latest.mau.toLocaleString()}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>
            DAU/MAU {((latest.dau / latest.mau) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>次日留存</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{latest.retentionD1Pct}%</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>
            7 日 {latest.retentionD7Pct}% · 30 日 {latest.retentionD30Pct}%
          </div>
        </div>
        <div className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>慧读渗透（周）</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{latest.huiduPenetrationPct}%</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)" }}>
            人均 {latest.avgRoundsPerSession} 轮/会话
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12, minHeight: 0 }}>
        <div className="card" style={{ borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>各模块使用时长占比</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MODULE_BARS.map((m) => {
              const pct = latest[m.key];
              return (
                <div key={m.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    <span>{m.label}</span><span>{pct}%</span>
                  </div>
                  <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 100 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 100 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--surface-2)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>AI 用量（今日）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{latest.aiCallCount.toLocaleString()}</div>调用量</div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{formatCompactNumber(latest.aiTokenCount)}</div>Token</div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{(latest.aiAvgFirstTokenMs / 1000).toFixed(1)}s</div>平均首字</div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{latest.aiLikeRatePct}%</div>点赞率</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>社群活跃度排行</div>
            <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--body)" }}>每日更新 · 可下钻</div>
          </div>
          {ranking.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--surface-2)", fontSize: 12 }}>
              <div style={{ fontWeight: 800, color: "var(--purple)", width: 16 }}>{i + 1}</div>
              <div style={{ flex: 1, fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>日互动 {c.dailyActivity}</div>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800 }}>热门 AI 话题</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {hotTopics.map((t) => (
              <div key={t.id} className="pill pill-purple">{t.label}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
