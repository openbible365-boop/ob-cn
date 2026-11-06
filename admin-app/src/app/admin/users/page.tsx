import { db } from "@/lib/db";
import { SearchShortcut, ShortcutHint } from "@/components/ui/SearchShortcut";
import { formatDateTime, formatLoginMethods, formatUserTier } from "@/lib/format";
import { muteUser, unbanUser } from "@/lib/actions/users";
import { BanUserControl } from "@/components/BanUserControl";
import { UserAvatar } from "@/components/UserAvatar";
import type { Prisma } from "@/generated/prisma/client";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, PageHeader } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";

/** 列定义只此一份，表头与所有行由 DataTable 的 Context 共享 */
const USER_COLUMNS: Column[] = [
  { key: "user", label: "用户", width: "1.6fr" },
  { key: "login", label: "登录方式", width: "110px" },
  { key: "last", label: "最近登录", width: "130px" },
  { key: "groups", label: "所属群组", width: "90px", align: "right" },
  { key: "tier", label: "用户等级", width: "110px" },
  { key: "status", label: "状态", width: "84px" },
  { key: "ops", label: "操作", width: "220px" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  // Seed users have AuthAccount rows without a provider account id. Real
  // email/Apple registrations always persist the provider identity, so the
  // admin list only exposes accounts created by an actual login flow.
  const registeredUserWhere: Prisma.UserWhereInput = {
    authAccounts: { some: { providerAccountId: { not: null } } },
  };
  const where: Prisma.UserWhereInput = q
    ? {
        AND: [
          registeredUserWhere,
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      }
    : registeredUserWhere;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        authAccounts: true,
        memberships: true,
        _count: {
          select: {
            highlights: true,
            notes: true,
          },
        },
      },
      orderBy: { uid: "asc" },
      ...pageQuery(page),
    }),
    // 统计跟随当前筛选条件，否则搜索后「共 N 条」仍是全量数字
    db.user.count({ where }),
  ]);
  const info = pageInfo(page, total);

  const fmtLogin = (d: Date | null) =>
    d ? formatDateTime(d) : "从未登录";

  return (
    <>
      <SearchShortcut />
      <PageHeader
        title="用户管理"
        meta={q ? `匹配 ${total} 名用户` : `共 ${total} 名注册用户`}
        actions={
          <form className="search-box" action="/admin/users">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input name="q" placeholder="搜索用户名 / email" defaultValue={q ?? ""} />
          </form>
        }
      />

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: 0, overflow: "auto" }}>
        <DataTable columns={USER_COLUMNS} label="用户列表">
        <DataTable.Head />

        {users.map((u) => {
          const level = formatUserTier(u.tier, u.tierPriceCents);
          const login = formatLoginMethods(u.authAccounts.map((a) => a.provider));
          const statusLabel =
            u.status === "BANNED" ? "封禁中" : u.status === "MUTED" ? "禁言中" : "正常";

          return (
            <DataTable.Row key={u.id} tone={u.status === "BANNED" ? "err" : undefined}>
              <DataTable.Cell>
                <div className="user-cell">
                  <UserAvatar name={u.name} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} />
                  <div className="user-cell-text">
                    <div className="user-cell-name" title={`${u.name} · UID ${u.uid}`}>
                      {u.name} <span>· UID {u.uid}</span>
                    </div>
                    {u.email && <div className="user-cell-sub" title={u.email}>{u.email}</div>}
                    <div className="user-cell-sub">
                      高亮 {u._count.highlights} · 笔记 {u._count.notes}
                    </div>
                  </div>
                </div>
              </DataTable.Cell>
              <DataTable.Cell truncate title={login}>{login}</DataTable.Cell>
              <DataTable.Cell truncate>{fmtLogin(u.lastLoginAt)}</DataTable.Cell>
              <DataTable.Cell align="right">{u.memberships.length} 个</DataTable.Cell>
              <DataTable.Cell><Badge tone="info">{level}</Badge></DataTable.Cell>
              <DataTable.Cell>
                <Badge tone={u.status === "BANNED" ? "err" : u.status === "MUTED" ? "warn" : "ok"}>
                  {statusLabel}
                </Badge>
              </DataTable.Cell>
              <DataTable.Cell>
              <div className="row-actions">
                {u.status !== "BANNED" && (
                  <form action={muteUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className="action-orange">禁言 7 天</button>
                  </form>
                )}
                {u.status === "BANNED" ? (
                  <>
                    <form action={unbanUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="action-purple">解封</button>
                    </form>
                    <span className="action-body">封禁原因：{u.banReason}</span>
                  </>
                ) : (
                  <BanUserControl userId={u.id} />
                )}
              </div>
              </DataTable.Cell>
            </DataTable.Row>
          );
        })}
        </DataTable>

        {users.length === 0 && (
          <EmptyState
            title={q ? "没有找到匹配的真实注册用户" : "暂无真实注册用户"}
            hint={q ? "换个关键词试试，或清除搜索条件" : "用户完成邮箱或 Apple 登录后会自动出现在这里"}
          />
        )}

        <Pagination info={info} basePath="/admin/users" params={{ q }} />
      </div>
    </>
  );
}
