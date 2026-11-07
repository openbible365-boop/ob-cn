import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Grid, PageHeader, Split, Stat } from "@/components/ui/Primitives";
import { REAL_USER_WHERE, countByDay, recentDayKeys } from "@/lib/admin-metrics";
import { formatDateTime } from "@/lib/format";
import { TrendBars } from "@/components/ui/TrendBars";

// 数据看板：全部直接统计业务表，不再读种子写入的 DailyMetric 演示快照（DAU/留存等假数据）。
// 口径与「用户管理」一致：只算真实注册用户。

const DAY = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

function TodoRow({ label, count, href, hint }: { label: string; count: number; href: string; hint: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
        borderTop: "1px solid var(--surface-2)", color: "var(--ink)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{hint}</span>
      </span>
      <span style={{
        minWidth: 28, padding: "2px 9px", borderRadius: 100, textAlign: "center", fontSize: 12, fontWeight: 700,
        background: count > 0 ? "var(--yellow-soft)" : "var(--surface-2)",
        color: count > 0 ? "var(--yellow-ink)" : "var(--muted)",
      }}>
        {count}
      </span>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>→</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const trendStart = new Date(now.getTime() - TREND_DAYS * DAY);
  const dayKeys = recentDayKeys(TREND_DAYS, now);

  // 「活跃」= 期间内登录过、同步过阅读位置、写过笔记/高亮或开过慧读对话（登录态通常长期保持，只看登录会严重低估）
  const activeSince = (since: Date) => ({
    AND: [
      REAL_USER_WHERE,
      {
        OR: [
          { lastLoginAt: { gte: since } },
          { readingPositionAt: { gte: since } },
          { notes: { some: { createdAt: { gte: since } } } },
          { highlights: { some: { createdAt: { gte: since } } } },
          { conversations: { some: { createdAt: { gte: since } } } },
        ],
      },
    ],
  });

  const [
    totalUsers, newUsersWeek, active7, active30,
    conversationsTotal, questionsTotal, conversationsWeek, huiduUsersWeek,
    notesWeek, highlightsWeek, pendingFeedback, pushDevices,
    newUserDates, conversationDates, latestFeedback, readingWeek,
  ] = await Promise.all([
    db.user.count({ where: REAL_USER_WHERE }),
    db.user.count({ where: { AND: [REAL_USER_WHERE, { createdAt: { gte: weekAgo } }] } }),
    db.user.count({ where: activeSince(weekAgo) }),
    db.user.count({ where: activeSince(monthAgo) }),
    db.conversation.count(),
    db.message.count({ where: { role: "USER" } }),
    db.conversation.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { conversations: { some: { createdAt: { gte: weekAgo } } } } }),
    db.note.count({ where: { createdAt: { gte: weekAgo } } }),
    db.highlight.count({ where: { createdAt: { gte: weekAgo } } }),
    db.feedback.count({ where: { handled: false } }),
    db.devicePushToken.count({ where: { enabled: true } }),
    db.user.findMany({ where: { AND: [REAL_USER_WHERE, { createdAt: { gte: trendStart } }] }, select: { createdAt: true } }),
    db.conversation.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
    db.feedback.findFirst({ where: { handled: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.$queryRaw<{ kind: "BIBLE" | "COMMENTARY"; reads: bigint; devices: bigint }[]>`
      SELECT "kind", COUNT(*) AS reads, COUNT(DISTINCT "deviceId") AS devices
      FROM "ReadingEvent" WHERE "occurredAt" >= ${weekAgo} GROUP BY "kind"`,
  ]);
  const readOf = (kind: "BIBLE" | "COMMENTARY") => readingWeek.find((row) => row.kind === kind);

  const newUserSeries = countByDay(newUserDates.map((row) => row.createdAt), dayKeys);
  const conversationSeries = countByDay(conversationDates.map((row) => row.createdAt), dayKeys);

  return (
    <>
      <PageHeader title="数据看板" meta={`实时统计 · ${formatDateTime(now)} · 仅计真实注册用户`} />

      <Grid min="160px">
        <Card><Stat label="注册用户" value={totalUsers.toLocaleString()} hint={`近 7 天新增 ${newUsersWeek}`} /></Card>
        <Card><Stat label="7 日活跃" value={active7.toLocaleString()} hint={totalUsers ? `占注册用户 ${Math.round((active7 / totalUsers) * 100)}%` : undefined} /></Card>
        <Card><Stat label="30 日活跃" value={active30.toLocaleString()} /></Card>
        <Card><Stat label="慧读对话" value={conversationsTotal.toLocaleString()} hint={`累计提问 ${questionsTotal.toLocaleString()} 次`} /></Card>
        <Card><Stat label="近 7 天用慧读" value={`${huiduUsersWeek} 人`} hint={`新对话 ${conversationsWeek} 个`} /></Card>
        <Card><Stat label="近 7 天笔记 / 高亮" value={`${notesWeek} / ${highlightsWeek}`} /></Card>
        <Card>
          <Stat
            label="近 7 天读经"
            value={`${Number(readOf("BIBLE")?.reads ?? 0).toLocaleString()} 章次`}
            hint={`${Number(readOf("BIBLE")?.devices ?? 0)} 人在读`}
          />
        </Card>
        <Card>
          <Stat
            label="近 7 天读注释"
            value={`${Number(readOf("COMMENTARY")?.reads ?? 0).toLocaleString()} 章次`}
            hint={`${Number(readOf("COMMENTARY")?.devices ?? 0)} 人在读`}
          />
        </Card>
      </Grid>

      <Split ratio="1.4fr 1fr">
        <Card>
          <div style={{ display: "grid", gap: 22 }}>
            <TrendBars title="每日新注册" values={newUserSeries} dayKeys={dayKeys} color="var(--yellow)" unit="人" />
            <TrendBars title="每日新慧读对话" values={conversationSeries} dayKeys={dayKeys} color="var(--purple)" unit="个" />
          </div>
        </Card>

        <Card>
          <strong style={{ display: "block", fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>待办</strong>
          <TodoRow
            label="待处理意见反馈"
            count={pendingFeedback}
            href="/admin/feedback"
            hint={latestFeedback ? `最新一条 ${formatDateTime(latestFeedback.createdAt)}` : "暂无新留言"}
          />
          <TodoRow
            label="阅读统计"
            count={Number(readOf("BIBLE")?.reads ?? 0)}
            href="/admin/reading-stats"
            hint="近 7 天读经章次，看哪些书卷读得最多"
          />
          <TodoRow label="AI 对话记录" count={conversationsWeek} href="/admin/ai-records" hint="近 7 天新对话，可抽查回答质量" />
          <TodoRow label="可推送设备" count={pushDevices} href="/admin/notifications" hint="已开启通知的手机，可发送推送" />
        </Card>
      </Split>
    </>
  );
}
