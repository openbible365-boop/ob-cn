import Link from "next/link";
import { db } from "@/lib/db";
import { SearchShortcut } from "@/components/ui/SearchShortcut";
import { formatDate, formatDateTime, formatLoginMethods } from "@/lib/format";
import { muteUser, unbanUser, unmuteUser } from "@/lib/actions/users";
import { BanUserControl } from "@/components/BanUserControl";
import { UserAvatar } from "@/components/UserAvatar";
import type { Prisma } from "@/generated/prisma/client";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, PageHeader } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { REAL_USER_WHERE } from "@/lib/admin-metrics";
import { SHOW_COMMUNITY_ADMIN } from "@/lib/admin-features";

// 用户管理：只列真实注册用户（口径见 lib/admin-metrics.ts，含后台开通的密码登录账号）。
// 「所属群组」只在社群功能开放时显示；「用户等级」对应的付费功能未开放，不再显示。

const USER_COLUMNS: Column[] = [
  { key: "user", label: "用户", width: "1.6fr" },
  { key: "usage", label: "使用情况", width: "170px" },
  { key: "login", label: "登录方式", width: "110px" },
  { key: "last", label: "注册 / 最近登录", width: "150px" },
  ...(SHOW_COMMUNITY_ADMIN ? [{ key: "groups", label: "所属群组", width: "80px", align: "right" as const }] : []),
  { key: "status", label: "状态", width: "110px" },
  { key: "ops", label: "操作", width: "200px" },
];

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "ACTIVE", label: "正常" },
  { key: "MUTED", label: "禁言中" },
  { key: "BANNED", label: "封禁中" },
] as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q: rawQ, status = "all", page: pageParam } = await searchParams;
  const q = rawQ?.trim() || undefined;
  const page = parsePage(pageParam);
  const now = new Date();

  // 禁言到期的用户按「正常」算（状态字段要等下次操作才会改回）
  const statusWhere: Prisma.UserWhereInput =
    status === "BANNED" ? { status: "BANNED" }
    : status === "MUTED" ? { status: "MUTED", OR: [{ mutedUntil: null }, { mutedUntil: { gt: now } }] }
    : status === "ACTIVE" ? { OR: [{ status: "ACTIVE" }, { status: "MUTED", mutedUntil: { lte: now } }] }
    : {};

  const where: Prisma.UserWhereInput = {
    AND: [
      REAL_USER_WHERE,
      statusWhere,
      ...(q
        ? [{
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { password: { loginName: { contains: q.toLowerCase() } } },
              ...(/^\d+$/.test(q) ? [{ uid: Number(q) }] : []),
            ],
          }]
        : []),
    ],
  };

  const [users, total, statusCounts] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        authAccounts: true,
        password: { select: { loginName: true } },
        memberships: { select: { id: true } },
        _count: { select: { highlights: true, notes: true, conversations: true } },
      },
      orderBy: { createdAt: "desc" },
      ...pageQuery(page),
    }),
    db.user.count({ where }),
    Promise.all(
      STATUS_TABS.map((tab) =>
        db.user.count({
          where: {
            AND: [
              REAL_USER_WHERE,
              tab.key === "BANNED" ? { status: "BANNED" }
              : tab.key === "MUTED" ? { status: "MUTED", OR: [{ mutedUntil: null }, { mutedUntil: { gt: now } }] }
              : tab.key === "ACTIVE" ? { OR: [{ status: "ACTIVE" }, { status: "MUTED", mutedUntil: { lte: now } }] }
              : {},
            ],
          },
        }),
      ),
    ),
  ]);
  const info = pageInfo(page, total);
  // 本页用户的累计阅读章次（读经 / 注释）
  const readingRows = users.length
    ? await db.readingEvent.groupBy({
        by: ["userId", "kind"],
        where: { userId: { in: users.map((u) => u.id) } },
        _count: { _all: true },
      })
    : [];
  const readsOf = (userId: string, kind: "BIBLE" | "COMMENTARY") =>
    readingRows.find((row) => row.userId === userId && row.kind === kind)?._count._all ?? 0;

  const tabHref = (key: string) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (key !== "all") search.set("status", key);
    const query = search.toString();
    return `/admin/users${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <SearchShortcut />
      <PageHeader
        title="用户管理"
        meta={q ? `匹配 ${total} 名用户` : `共 ${statusCounts[0]} 名注册用户`}
        actions={
          <form className="search-box" action="/admin/users">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input name="q" placeholder="搜索昵称 / 邮箱 / 登录名 / UID" defaultValue={q ?? ""} />
          </form>
        }
      />

      <div style={{ display: "inline-flex", alignSelf: "flex-start", background: "var(--surface-2)", borderRadius: 100, padding: 3, gap: 2, marginBottom: 12 }}>
        {STATUS_TABS.map((tab, index) => {
          const active = status === tab.key;
          return (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 14px", borderRadius: 100,
                fontSize: 12, fontWeight: active ? 700 : 600,
                color: active ? "var(--ink)" : "var(--body)",
                background: active ? "var(--white)" : "transparent",
                boxShadow: active ? "var(--shadow-card)" : "none",
              }}
            >
              {tab.label}
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{statusCounts[index]}</span>
            </Link>
          );
        })}
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: 0, overflow: "auto" }}>
        <DataTable columns={USER_COLUMNS} label="用户列表">
          <DataTable.Head />

          {users.map((u) => {
            const methods = formatLoginMethods(u.authAccounts.filter((a) => a.providerAccountId).map((a) => a.provider));
            const login = [methods !== "—" ? methods : "", u.password ? "密码" : ""].filter(Boolean).join(" + ") || "—";
            const muteActive = u.status === "MUTED" && (!u.mutedUntil || u.mutedUntil > now);
            const statusLabel = u.status === "BANNED" ? "封禁中" : muteActive ? "禁言中" : "正常";
            const contact = u.email || u.password?.loginName;

            return (
              <DataTable.Row key={u.id} tone={u.status === "BANNED" ? "err" : undefined}>
                <DataTable.Cell>
                  <div className="user-cell">
                    <UserAvatar name={u.name} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} />
                    <div className="user-cell-text">
                      <div className="user-cell-name" title={`${u.name} · UID ${u.uid}`}>
                        {u.name} <span>· UID {u.uid}</span>
                      </div>
                      {contact && <div className="user-cell-sub" title={contact}>{contact}</div>}
                    </div>
                  </div>
                </DataTable.Cell>
                <DataTable.Cell>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--body)" }}>
                    <div>读经 {readsOf(u.id, "BIBLE")} 章 · 注释 {readsOf(u.id, "COMMENTARY")} 章</div>
                    <div>高亮 {u._count.highlights} · 笔记 {u._count.notes}</div>
                    {u._count.conversations > 0 ? (
                      <Link href={`/admin/ai-records?q=${encodeURIComponent(u.email || u.name)}`} style={{ color: "var(--purple)" }}>
                        慧读 {u._count.conversations} 个对话 →
                      </Link>
                    ) : (
                      <div style={{ color: "var(--muted)" }}>未用过慧读</div>
                    )}
                  </div>
                </DataTable.Cell>
                <DataTable.Cell truncate title={login}>{login}</DataTable.Cell>
                <DataTable.Cell>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div>{formatDate(u.createdAt)} 注册</div>
                    <div style={{ color: "var(--muted)" }}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "从未登录"}</div>
                  </div>
                </DataTable.Cell>
                {SHOW_COMMUNITY_ADMIN && (
                  <DataTable.Cell align="right">{u.memberships.length} 个</DataTable.Cell>
                )}
                <DataTable.Cell>
                  <div style={{ display: "grid", gap: 2 }}>
                    <span><Badge tone={u.status === "BANNED" ? "err" : muteActive ? "warn" : "ok"}>{statusLabel}</Badge></span>
                    {muteActive && u.mutedUntil && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>至 {formatDateTime(u.mutedUntil)}</span>
                    )}
                    {u.status === "BANNED" && u.banReason && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }} title={u.banReason}>
                        {u.banReason.length > 12 ? `${u.banReason.slice(0, 12)}…` : u.banReason}
                      </span>
                    )}
                  </div>
                </DataTable.Cell>
                <DataTable.Cell>
                  <div className="row-actions">
                    {u.status === "BANNED" ? (
                      <form action={unbanUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button type="submit" className="action-purple">解封</button>
                      </form>
                    ) : (
                      <>
                        {muteActive ? (
                          <form action={unmuteUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button type="submit" className="action-purple">解除禁言</button>
                          </form>
                        ) : (
                          <form action={muteUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button type="submit" className="action-orange">禁言 7 天</button>
                          </form>
                        )}
                        <BanUserControl userId={u.id} />
                      </>
                    )}
                  </div>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable>

        {users.length === 0 && (
          <EmptyState
            title={q || status !== "all" ? "没有符合条件的用户" : "暂无注册用户"}
            hint={q || status !== "all" ? "换个关键词或状态试试" : "用户通过邮箱、Apple、Google 登录后会自动出现在这里"}
          />
        )}

        <Pagination info={info} basePath="/admin/users" params={{ q, status: status === "all" ? undefined : status }} />
      </div>
    </>
  );
}
