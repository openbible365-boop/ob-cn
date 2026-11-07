import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { SearchShortcut } from "@/components/ui/SearchShortcut";
import { Badge, Card, Grid, Stat } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { Pagination } from "@/components/Pagination";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { formatDateTime } from "@/lib/format";
import { approvePrayer, deletePrayer, hidePrayer } from "@/lib/actions/prayer-wall";

// 祷告墙管理：App「祷告墙」上的代祷便签（postType=PRAYER）。
// 分「墙上 / 待审核 / 已撤下 / 已删除」四组：命中待审敏感词的代祷先进「待审核」，通过后才上墙。

const DAY = 24 * 60 * 60 * 1000;

type View = "visible" | "pending" | "hidden" | "deleted";

const PENDING_REPORT = { some: { status: "PENDING" as const } };

const VIEW_WHERE: Record<View, Prisma.PostWhereInput> = {
  visible: { status: "VISIBLE" },
  pending: { status: "HIDDEN", reports: PENDING_REPORT },
  hidden: { status: "HIDDEN", reports: { none: { status: "PENDING" } } },
  deleted: { status: "DELETED" },
};

const VIEWS: { key: View; label: string; hint: string }[] = [
  { key: "visible", label: "墙上显示中", hint: "所有人都能在 App 祷告墙上看到" },
  { key: "pending", label: "待审核", hint: "内容命中待审敏感词，通过后才会上墙" },
  { key: "hidden", label: "已撤下", hint: "管理员撤下的代祷，所有人都看不到" },
  { key: "deleted", label: "已删除", hint: "已删除的代祷，可恢复上墙" },
];

export default async function PrayerWallAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const weekAgo = new Date(new Date().getTime() - 7 * DAY);
  const base: Prisma.PostWhereInput = { postType: "PRAYER" };

  const counts = await Promise.all(VIEWS.map((v) => db.post.count({ where: { ...base, ...VIEW_WHERE[v.key] } })));
  const countOf = (key: View) => counts[VIEWS.findIndex((v) => v.key === key)];
  // 有待审核时默认先看待审核
  const requested = VIEWS.find((v) => v.key === params.view)?.key;
  const view: View = requested ?? (countOf("pending") > 0 ? "pending" : "visible");
  const current = VIEWS.find((v) => v.key === view)!;

  const where: Prisma.PostWhereInput = {
    ...base,
    ...VIEW_WHERE[view],
    ...(q
      ? {
          OR: [
            { content: { contains: q, mode: "insensitive" } },
            { author: { name: { contains: q, mode: "insensitive" } } },
            { author: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [prayers, total, newThisWeek, amenAgg, authorsWeek] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true, uid: true, avatarColor: true, avatarUrl: true } },
        reports: { orderBy: { createdAt: "desc" }, take: 1, select: { reason: true, status: true } },
      },
      ...pageQuery(page),
    }),
    db.post.count({ where }),
    db.post.count({ where: { ...base, createdAt: { gte: weekAgo }, status: { not: "DELETED" } } }),
    db.post.aggregate({ where: { ...base, status: "VISIBLE" }, _sum: { likeCount: true } }),
    db.post.groupBy({ by: ["authorId"], where: { ...base, createdAt: { gte: weekAgo } } }),
  ]);
  const info = pageInfo(page, total);

  const hrefFor = (overrides: { view?: View; q?: string }) => {
    const search = new URLSearchParams();
    search.set("view", overrides.view ?? view);
    const query = "q" in overrides ? overrides.q : q;
    if (query) search.set("q", query);
    return `/admin/prayer-wall?${search.toString()}`;
  };

  return (
    <>
      <SearchShortcut />
      <div className="admin-header">
        <div className="title">祷告墙</div>
        <div className="meta">App「祷告墙」上的代祷便签 · 发布时已过敏感词与禁言检查</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/prayer-wall">
          <input type="hidden" name="view" value={view} />
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索代祷内容 / 作者" defaultValue={q ?? ""} />
        </form>
      </div>

      <Grid min="160px">
        <Card><Stat label="墙上代祷" value={countOf("visible").toLocaleString()} /></Card>
        <Card><Stat label="近 7 天新代祷" value={newThisWeek.toLocaleString()} hint={`${authorsWeek.length} 人发布`} /></Card>
        <Card><Stat label="累计阿们" value={(amenAgg._sum.likeCount ?? 0).toLocaleString()} hint="墙上代祷收到的阿们" /></Card>
        <Card><Stat label="待审核" value={countOf("pending").toLocaleString()} tone={countOf("pending") > 0 ? "warn" : undefined} /></Card>
      </Grid>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, margin: "12px 0" }}>
        <div style={{ display: "inline-flex", flexWrap: "wrap", background: "var(--surface-2)", borderRadius: 100, padding: 3, gap: 2 }}>
          {VIEWS.map((v) => {
            const on = v.key === view;
            const count = countOf(v.key);
            return (
              <Link
                key={v.key}
                href={hrefFor({ view: v.key })}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 14px", borderRadius: 100,
                  fontSize: 12, fontWeight: on ? 700 : 600,
                  color: on ? "var(--ink)" : "var(--body)",
                  background: on ? "var(--white)" : "transparent",
                  boxShadow: on ? "var(--shadow-card)" : "none",
                }}
              >
                {v.label}
                <span style={{
                  fontSize: 11,
                  color: v.key === "pending" && count > 0 ? "#fff" : "var(--muted)",
                  background: v.key === "pending" && count > 0 ? "var(--pink)" : "transparent",
                  borderRadius: 100, padding: v.key === "pending" && count > 0 ? "0 6px" : 0,
                }}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{current.hint}</span>
      </div>

      {q && (
        <div style={{ fontSize: 12, color: "var(--body)", marginBottom: 10 }}>
          搜索「{q}」共 {total} 条 · <Link href={hrefFor({ q: undefined })} style={{ color: "var(--purple)" }}>清除搜索</Link>
        </div>
      )}

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: 0, overflow: "auto" }}>
        {prayers.length === 0 ? (
          <EmptyState
            title={q ? "没有找到匹配的代祷" : view === "pending" ? "没有待审核的代祷" : "这里还没有代祷"}
            hint={q ? "换个关键词试试" : view === "visible" ? "用户在 App 祷告墙发布代祷后会出现在这里" : current.hint}
          />
        ) : (
          prayers.map((prayer, index) => {
            const report = prayer.reports[0];
            return (
              <div
                key={prayer.id}
                style={{
                  display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "10px 16px",
                  padding: "14px 18px", borderTop: index ? "1px solid var(--line)" : "none",
                }}
              >
                <div className="user-cell" style={{ width: 170, flex: "none" }}>
                  <UserAvatar name={prayer.author.name} avatarColor={prayer.author.avatarColor} avatarUrl={prayer.author.avatarUrl} />
                  <div className="user-cell-text">
                    <div className="user-cell-name" title={prayer.author.name}>{prayer.author.name}</div>
                    <div className="user-cell-sub">UID {prayer.author.uid}</div>
                  </div>
                </div>

                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {prayer.content}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    <span>{formatDateTime(prayer.createdAt)}</span>
                    <span>· 🙏 {prayer.likeCount} 阿们</span>
                    {report && <Badge tone={report.status === "PENDING" ? "warn" : "neutral"}>{report.reason}</Badge>}
                  </div>
                </div>

                <div className="row-actions" style={{ flex: "none" }}>
                  {prayer.status !== "VISIBLE" && (
                    <form action={approvePrayer}>
                      <input type="hidden" name="postId" value={prayer.id} />
                      <button type="submit" className="action-purple">
                        {view === "pending" ? "通过上墙" : "恢复上墙"}
                      </button>
                    </form>
                  )}
                  {prayer.status !== "HIDDEN" && prayer.status !== "DELETED" && (
                    <form action={hidePrayer}>
                      <input type="hidden" name="postId" value={prayer.id} />
                      <button type="submit" className="action-orange">撤下</button>
                    </form>
                  )}
                  {view === "pending" && (
                    <form action={hidePrayer}>
                      <input type="hidden" name="postId" value={prayer.id} />
                      <button type="submit" className="action-orange">不通过</button>
                    </form>
                  )}
                  {prayer.status !== "DELETED" && (
                    <form action={deletePrayer}>
                      <input type="hidden" name="postId" value={prayer.id} />
                      <ConfirmSubmitButton className="action-pink" confirmMessage="删除这条代祷？删除后可在「已删除」里恢复。">
                        删除
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div style={{ padding: "0 18px" }}>
          <Pagination info={info} basePath="/admin/prayer-wall" params={{ view, q }} />
        </div>
      </div>
    </>
  );
}
