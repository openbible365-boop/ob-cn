import { db } from "@/lib/db";
import { Badge, Card, Grid, PageHeader, Split, Stat } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { formatCompactNumber, formatDate } from "@/lib/format";

const MODULE_BARS = [
  { key: "bibleReadingPct", label: "读经", color: "var(--yellow)" },
  { key: "huiduPct", label: "慧读", color: "var(--purple)" },
  { key: "communityPct", label: "社群", color: "var(--orange)" },
  { key: "annotationPct", label: "注释", color: "var(--body)" },
] as const;

// 实时概览：直接数业务表，不依赖 T+1 快照——空快照库也有真实数据可看
async function loadLiveOverview() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, active7d, notes, highlights, conversations, posts] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastLoginAt: { gte: weekAgo } } }),
    db.note.count(),
    db.highlight.count(),
    db.conversation.count(),
    db.post.count(),
  ]);
  return [
    { label: "注册用户", value: users },
    { label: "7 日活跃", value: active7d },
    { label: "笔记（双端）", value: notes },
    { label: "高亮（双端）", value: highlights },
    { label: "慧读会话", value: conversations },
    { label: "社群帖子", value: posts },
  ];
}

function LiveOverview({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <Grid min="150px">
      {stats.map((s) => (
        <Card key={s.label}>
          <Stat label={s.label} value={s.value.toLocaleString()} />
        </Card>
      ))}
    </Grid>
  );
}

export default async function DashboardPage() {
  const [latest, liveStats] = await Promise.all([
    db.dailyMetric.findFirst({ orderBy: { date: "desc" } }),
    loadLiveOverview(),
  ]);

  if (!latest) {
    return (
      <>
        <PageHeader title="数据看板" meta="实时统计 · 快照指标（DAU/留存等）待每日汇总任务生成" />
        <LiveOverview stats={liveStats} />
        <Card padded={false}>
          <EmptyState
            title="快照指标尚未生成"
            hint="DAU / 留存 / 热点话题由每日汇总任务在次日 06:00 产出，首次运行后这里会显示完整看板。"
          />
        </Card>
      </>
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
      <PageHeader
        title="数据看板"
        meta={`实时统计 + 快照（T+1，更新于 ${formatDate(latest.date)} 06:00）`}
      />

      <LiveOverview stats={liveStats} />

      <Grid min="170px">
        <Card>
          <Stat
            label="DAU（双端）"
            value={latest.dau.toLocaleString()}
            hint={
              dauDeltaPct !== null
                ? `${dauDeltaPct >= 0 ? "↑" : "↓"} ${Math.abs(dauDeltaPct).toFixed(1)}% 周环比`
                : undefined
            }
            tone={dauDeltaPct === null ? undefined : dauDeltaPct >= 0 ? "ok" : "err"}
          />
        </Card>
        <Card>
          <Stat
            label="MAU"
            value={latest.mau.toLocaleString()}
            hint={`DAU/MAU ${((latest.dau / latest.mau) * 100).toFixed(1)}%`}
          />
        </Card>
        <Card>
          <Stat
            label="次日留存"
            value={`${latest.retentionD1Pct}%`}
            hint={`7 日 ${latest.retentionD7Pct}% · 30 日 ${latest.retentionD30Pct}%`}
          />
        </Card>
        <Card>
          <Stat
            label="慧读渗透（周）"
            value={`${latest.huiduPenetrationPct}%`}
            hint={`人均 ${latest.avgRoundsPerSession} 轮/会话`}
          />
        </Card>
      </Grid>

      <Split ratio="1.3fr 1fr">
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
            <Grid min="110px" gap="10px">
              <Stat label="调用量" value={latest.aiCallCount.toLocaleString()} />
              <Stat label="Token" value={formatCompactNumber(latest.aiTokenCount)} />
              <Stat label="平均首字" value={`${(latest.aiAvgFirstTokenMs / 1000).toFixed(1)}s`} />
              <Stat label="点赞率" value={`${latest.aiLikeRatePct}%`} />
            </Grid>
          </div>
        </div>

        <div className="card" style={{ borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>社群活跃度排行</div>
            <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--body)" }}>每日更新 · 可下钻</div>
          </div>
          {ranking.length > 0 ? (
            ranking.map((c, i) => (
              <div key={c.id} className="rank-row">
                <span className="rank-no">{i + 1}</span>
                <span className="rank-name" title={c.name}>{c.name}</span>
                <span className="rank-value">日互动 {c.dailyActivity}</span>
              </div>
            ))
          ) : (
            <EmptyState title="暂无活跃社群" hint="社群产生互动后会按日互动量排名显示在这里" />
          )}
          <div className="rank-subtitle">热门 AI 话题</div>
          {hotTopics.length > 0 ? (
            <div className="tag-row">
              {hotTopics.map((t) => (
                <Badge key={t.id} tone="info">{t.label}</Badge>
              ))}
            </div>
          ) : (
            <p className="rank-empty-hint">今日尚未汇总出热门话题</p>
          )}
        </div>
      </Split>
    </>
  );
}
