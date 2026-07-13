import { db } from "@/lib/db";

type Status = "UPCOMING" | "ONGOING" | "ENDED";

const STATUS_LABEL: Record<Status, string> = { UPCOMING: "未开始", ONGOING: "进行中", ENDED: "已结束" };
const STATUS_PILL: Record<Status, string> = { UPCOMING: "pill-purple", ONGOING: "pill-yellow", ENDED: "pill-muted" };

function computeStatus(startAt: Date, endAt: Date | null, now: Date): Status {
  if (now < startAt) return "UPCOMING";
  if (endAt && now > endAt) return "ENDED";
  return "ONGOING";
}

function formatDateTime(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  const events = await db.event.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { community: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: { community: true },
    orderBy: { startAt: "asc" },
  });

  const now = new Date();
  const withStatus = events.map((e) => ({ ...e, computedStatus: computeStatus(e.startAt, e.endAt, now) }));
  const filtered = status && status !== "all" ? withStatus.filter((e) => e.computedStatus === status) : withStatus;

  const STATUS_TABS: { key: string; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "ONGOING", label: "进行中" },
    { key: "UPCOMING", label: "未开始" },
    { key: "ENDED", label: "已结束" },
  ];

  return (
    <>
      <div className="admin-header">
        <div className="title">活动监管</div>
        <div className="meta">全站活动列表 · 共 {events.length} 场</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/events">
          {status && status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索活动 / 社群" defaultValue={q ?? ""} />
        </form>
      </div>

      <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 100, padding: 3, marginBottom: 12, alignSelf: "flex-start" }}>
        {STATUS_TABS.map((t) => (
          <a
            key={t.key}
            href={`/events?${new URLSearchParams({ ...(q ? { q } : {}), status: t.key }).toString()}`}
            style={{
              display: "flex", alignItems: "center", height: 30, padding: "0 14px", borderRadius: 100,
              fontSize: 12, fontWeight: (status ?? "all") === t.key ? 700 : 600,
              color: (status ?? "all") === t.key ? "var(--ink)" : "var(--body)",
              background: (status ?? "all") === t.key ? "var(--white)" : "transparent",
              boxShadow: (status ?? "all") === t.key ? "var(--shadow-card)" : "none",
            }}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.6fr 140px 170px 170px 100px 100px" }}>
          <div>活动名称</div><div>所属社群</div><div>开始时间</div><div>结束时间</div><div>已报名</div><div>状态</div>
        </div>
        {filtered.map((e) => (
          <div key={e.id} className="admin-table-row" style={{ gridTemplateColumns: "1.6fr 140px 170px 170px 100px 100px" }}>
            <div style={{ fontWeight: 700 }}>{e.title}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{e.community.name}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{formatDateTime(e.startAt)}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{e.endAt ? formatDateTime(e.endAt) : "长期"}</div>
            <div style={{ fontWeight: 700 }}>{e.signupCount}</div>
            <div><span className={`pill ${STATUS_PILL[e.computedStatus]}`}>{STATUS_LABEL[e.computedStatus]}</span></div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: "var(--body)" }}>没有符合条件的活动</div>
        )}
      </div>
    </>
  );
}
