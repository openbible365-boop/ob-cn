import Link from "next/link";
import { db } from "@/lib/db";
import { BOOKS } from "@/lib/bible-books";
import { Card, Grid, PageHeader, Split, Stat } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { TrendBars } from "@/components/ui/TrendBars";
import { recentDayKeys } from "@/lib/admin-metrics";
import { ADMIN_TIMEZONE, formatDateTime } from "@/lib/format";

// 阅读统计：读经 / 读注释按「章次」计（同一设备同一章每天记一次，停留 ≥ 8 秒才算）。
// 人数按设备去重（未登录也算）；数据来自 App 与网页版上报的 ReadingEvent。

const DAY = 24 * 60 * 60 * 1000;
const RANGES = [
  { key: "7", label: "近 7 天", days: 7 },
  { key: "30", label: "近 30 天", days: 30 },
  { key: "90", label: "近 90 天", days: 90 },
] as const;

const BOOK_NAME = new Map(BOOKS.map((book) => [book.code, book.zh]));
const VERSION_NAME: Record<string, string> = {
  cuv: "和合本", cnvs: "新译本", pinyin: "拼音和合本", kjv: "KJV", bsb: "BSB",
  krv: "개역한글", snr: "새번역", keb: "쉬운성경", nkv: "조선어성경",
};
const PLATFORM_NAME: Record<string, string> = { ios: "iPhone", android: "安卓", web: "网页版", "": "未知" };

type Kind = "BIBLE" | "COMMENTARY";

function RankList({ title, rows, total, empty }: {
  title: string;
  rows: { label: string; count: number }[];
  total: number;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card>
      <strong style={{ display: "block", fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>{title}</strong>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((row, index) => (
            <div key={row.label} style={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 54px", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontWeight: 700 }}>{index + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                  <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                  {total > 0 && <span style={{ color: "var(--muted)" }}>{Math.round((row.count / total) * 100)}%</span>}
                </div>
                <div style={{ height: 6, borderRadius: 100, background: "var(--surface-2)" }}>
                  <div style={{ width: `${(row.count / max) * 100}%`, height: "100%", borderRadius: 100, background: "var(--yellow)" }} />
                </div>
              </div>
              <span style={{ textAlign: "right", fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{row.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default async function ReadingStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam) ?? RANGES[0];
  const now = new Date();
  const since = new Date(now.getTime() - range.days * DAY);
  const trendDays = Math.min(range.days, 30);
  const trendSince = new Date(now.getTime() - trendDays * DAY);
  const dayKeys = recentDayKeys(trendDays, now);

  const [summary, daily, topBooks, topChapters, versions, commentaryBooks, commentaryChapters, platforms] = await Promise.all([
    db.$queryRaw<{ kind: Kind; reads: bigint; devices: bigint; users: bigint }[]>`
      SELECT "kind", COUNT(*) AS reads, COUNT(DISTINCT "deviceId") AS devices, COUNT(DISTINCT "userId") AS users
      FROM "ReadingEvent" WHERE "occurredAt" >= ${since} GROUP BY "kind"`,
    db.$queryRaw<{ day: string; kind: Kind; reads: bigint }[]>`
      SELECT to_char(("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ADMIN_TIMEZONE}, 'YYYY-MM-DD') AS day, "kind", COUNT(*) AS reads
      FROM "ReadingEvent" WHERE "occurredAt" >= ${trendSince} GROUP BY 1, 2`,
    db.readingEvent.groupBy({ by: ["book"], where: { kind: "BIBLE", occurredAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { book: "desc" } }, take: 10 }),
    db.readingEvent.groupBy({ by: ["book", "chapter"], where: { kind: "BIBLE", occurredAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { book: "desc" } }, take: 10 }),
    db.readingEvent.groupBy({ by: ["version"], where: { kind: "BIBLE", occurredAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { version: "desc" } } }),
    db.readingEvent.groupBy({ by: ["book"], where: { kind: "COMMENTARY", occurredAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { book: "desc" } }, take: 10 }),
    db.readingEvent.groupBy({ by: ["book", "chapter"], where: { kind: "COMMENTARY", occurredAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { book: "desc" } }, take: 10 }),
    db.$queryRaw<{ platform: string; devices: bigint }[]>`
      SELECT "platform", COUNT(DISTINCT "deviceId") AS devices FROM "ReadingEvent" WHERE "occurredAt" >= ${since} GROUP BY "platform"`,
  ]);

  const pick = (kind: Kind) => summary.find((row) => row.kind === kind);
  const bible = { reads: Number(pick("BIBLE")?.reads ?? 0), devices: Number(pick("BIBLE")?.devices ?? 0), users: Number(pick("BIBLE")?.users ?? 0) };
  const commentary = { reads: Number(pick("COMMENTARY")?.reads ?? 0), devices: Number(pick("COMMENTARY")?.devices ?? 0) };
  const series = (kind: Kind) => dayKeys.map((day) => Number(daily.find((row) => row.day === day && row.kind === kind)?.reads ?? 0));
  const chapterLabel = (book: string, chapter: number) =>
    `${BOOK_NAME.get(book) ?? book} ${chapter === 0 ? "绪论" : `${chapter} 章`}`;

  const hasData = bible.reads + commentary.reads > 0;

  return (
    <>
      <PageHeader
        title="阅读统计"
        meta={`读经与读注释按章计 · 停留满 8 秒算一次，同一设备同一章每天只记一次 · ${formatDateTime(now)}`}
        actions={
          <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 100, padding: 3, gap: 2 }}>
            {RANGES.map((r) => {
              const on = r.key === range.key;
              return (
                <Link
                  key={r.key}
                  href={`/admin/reading-stats?range=${r.key}`}
                  style={{
                    height: 30, padding: "0 14px", display: "inline-flex", alignItems: "center", borderRadius: 100,
                    fontSize: 12, fontWeight: on ? 700 : 600, color: on ? "var(--ink)" : "var(--body)",
                    background: on ? "var(--white)" : "transparent", boxShadow: on ? "var(--shadow-card)" : "none",
                  }}
                >
                  {r.label}
                </Link>
              );
            })}
          </div>
        }
      />

      <Grid min="170px">
        <Card><Stat label="读经章次" value={bible.reads.toLocaleString()} hint={range.label} /></Card>
        <Card>
          <Stat
            label="读经人数"
            value={bible.devices.toLocaleString()}
            hint={`其中登录用户 ${bible.users} · 人均 ${bible.devices ? (bible.reads / bible.devices).toFixed(1) : 0} 章`}
          />
        </Card>
        <Card><Stat label="注释阅读章次" value={commentary.reads.toLocaleString()} hint={range.label} /></Card>
        <Card>
          <Stat
            label="读注释人数"
            value={commentary.devices.toLocaleString()}
            hint={bible.devices ? `占读经人数 ${Math.round((commentary.devices / bible.devices) * 100)}%` : undefined}
          />
        </Card>
      </Grid>

      {!hasData ? (
        <Card padded={false}>
          <EmptyState title={`${range.label}还没有阅读记录`} hint="用户在 App 或网页版读经、读注释（每章停留满 8 秒）后，这里开始有数据" />
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
              <TrendBars title="每日读经章次" values={series("BIBLE")} dayKeys={dayKeys} color="var(--yellow)" unit="章次" />
              <TrendBars title="每日注释阅读章次" values={series("COMMENTARY")} dayKeys={dayKeys} color="var(--purple)" unit="章次" />
            </div>
          </Card>

          <Split ratio="1fr 1fr">
            <RankList
              title="读得最多的书卷"
              rows={topBooks.map((row) => ({ label: BOOK_NAME.get(row.book) ?? row.book, count: row._count._all }))}
              total={bible.reads}
              empty="暂无读经记录"
            />
            <RankList
              title="读得最多的章节"
              rows={topChapters.map((row) => ({ label: chapterLabel(row.book, row.chapter), count: row._count._all }))}
              total={bible.reads}
              empty="暂无读经记录"
            />
          </Split>

          <Split ratio="1fr 1fr">
            <RankList
              title="注释读得最多的书卷"
              rows={commentaryBooks.map((row) => ({ label: BOOK_NAME.get(row.book) ?? row.book, count: row._count._all }))}
              total={commentary.reads}
              empty="暂无注释阅读记录"
            />
            <RankList
              title="注释读得最多的章节"
              rows={commentaryChapters.map((row) => ({ label: chapterLabel(row.book, row.chapter), count: row._count._all }))}
              total={commentary.reads}
              empty="暂无注释阅读记录"
            />
          </Split>

          <Split ratio="1fr 1fr">
            <RankList
              title="译本使用"
              rows={versions.map((row) => ({ label: VERSION_NAME[row.version] ?? row.version, count: row._count._all }))}
              total={bible.reads}
              empty="暂无读经记录"
            />
            <RankList
              title="阅读人数 · 按平台"
              rows={platforms
                .map((row) => ({ label: PLATFORM_NAME[row.platform] ?? row.platform, count: Number(row.devices) }))
                .sort((a, b) => b.count - a.count)}
              total={platforms.reduce((sum, row) => sum + Number(row.devices), 0)}
              empty="暂无数据"
            />
          </Split>
        </>
      )}
    </>
  );
}
