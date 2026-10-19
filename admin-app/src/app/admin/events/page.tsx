import { db } from "@/lib/db";
import { SearchShortcut, ShortcutHint } from "@/components/ui/SearchShortcut";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, type Tone } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";

type Status = "UPCOMING" | "ONGOING" | "ENDED";

const STATUS_LABEL: Record<Status, string> = { UPCOMING: "未开始", ONGOING: "进行中", ENDED: "已结束" };
// 语义映射：进行中是需要关注的状态，用告警色；未开始是中性信息；已结束淡化
const STATUS_TONE: Record<Status, Tone> = { UPCOMING: "info", ONGOING: "warn", ENDED: "neutral" };

const EVENT_COLUMNS: Column[] = [
  { key: "title", label: "活动名称", width: "1.6fr" },
  { key: "community", label: "所属社群", width: "140px" },
  { key: "start", label: "开始时间", width: "160px" },
  { key: "end", label: "结束时间", width: "160px" },
  { key: "signups", label: "已报名", width: "90px", align: "right" },
  { key: "status", label: "状态", width: "90px" },
];

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
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const now = new Date();
  // 活动状态由起止时间推导，原先是「取全表再在内存里过滤」——活动一多就会把整表拉进内存。
  // 这里把状态翻译成时间条件下推给数据库，配合分页。
  const statusWhere =
    status === "ONGOING" ? { startAt: { lte: now }, endAt: { gte: now } }
    : status === "UPCOMING" ? { startAt: { gt: now } }
    : status === "ENDED" ? { endAt: { lt: now } }
    : {};
  const where = {
    ...statusWhere,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { community: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    db.event.findMany({
      where,
      include: { community: true },
      orderBy: { startAt: "asc" },
      ...pageQuery(page),
    }),
    db.event.count({ where }),
  ]);
  const info = pageInfo(page, total);

  const filtered = events.map((e) => ({ ...e, computedStatus: computeStatus(e.startAt, e.endAt, now) }));

  const STATUS_TABS: { key: string; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "ONGOING", label: "进行中" },
    { key: "UPCOMING", label: "未开始" },
    { key: "ENDED", label: "已结束" },
  ];

  return (
    <>
      <SearchShortcut />
      <div className="admin-header">
        <div className="title">活动监管</div>
        <div className="meta">全站活动列表 · 共 {events.length} 场</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/events">
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
        <DataTable columns={EVENT_COLUMNS} label="活动列表">
          <DataTable.Head />
          {filtered.map((e) => (
            <DataTable.Row key={e.id} tone={e.computedStatus === "ONGOING" ? "warn" : undefined}>
              <DataTable.Cell truncate title={e.title}><strong>{e.title}</strong></DataTable.Cell>
              <DataTable.Cell truncate title={e.community.name}>{e.community.name}</DataTable.Cell>
              <DataTable.Cell>{formatDateTime(e.startAt)}</DataTable.Cell>
              <DataTable.Cell>{e.endAt ? formatDateTime(e.endAt) : "长期"}</DataTable.Cell>
              <DataTable.Cell align="right"><strong>{e.signupCount}</strong></DataTable.Cell>
              <DataTable.Cell>
                <Badge tone={STATUS_TONE[e.computedStatus]}>{STATUS_LABEL[e.computedStatus]}</Badge>
              </DataTable.Cell>
            </DataTable.Row>
          ))}
          {filtered.length === 0 && (
            <EmptyState
              title="没有符合条件的活动"
              hint={q || (status && status !== "all") ? "换个关键词或状态筛选试试" : "社群管理员在 App 端创建活动后会出现在这里"}
            />
          )}
        </DataTable>

        <Pagination info={info} basePath="/admin/events" params={{ q, status }} />
      </div>
    </>
  );
}
