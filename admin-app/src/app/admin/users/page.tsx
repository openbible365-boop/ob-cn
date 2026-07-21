import { db } from "@/lib/db";
import { deriveUserLevel, formatLoginMethods } from "@/lib/format";
import { muteUser, unbanUser } from "@/lib/actions/users";
import { BanUserControl } from "@/components/BanUserControl";
import { UserAvatar } from "@/components/UserAvatar";
import type { Prisma } from "@/generated/prisma/client";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

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
        memberships: { include: { community: true } },
        _count: {
          select: {
            highlights: true,
            notes: true,
          },
        },
      },
      orderBy: { uid: "asc" },
    }),
    db.user.count({ where: registeredUserWhere }),
  ]);

  const fmtLogin = (d: Date | null) =>
    d ? d.toISOString().slice(0, 16).replace("T", " ") : "从未登录";

  return (
    <>
      <div className="admin-header">
        <div className="title">用户管理</div>
        <div className="meta">共 {total} 名注册用户</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/users">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索用户名 / email" defaultValue={q ?? ""} />
        </form>
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.4fr 120px 130px 90px 110px 90px 220px" }}>
          <div>用户</div><div>登录方式</div><div>最近登录</div><div>所属群组</div><div>群用户级别</div><div>状态</div><div>操作</div>
        </div>

        {users.map((u) => {
          const level = deriveUserLevel(u.memberships.map((m) => m.community.tier));
          const login = formatLoginMethods(u.authAccounts.map((a) => a.provider));
          const statusLabel =
            u.status === "BANNED" ? "封禁中" : u.status === "MUTED" ? "禁言中" : "正常";

          return (
            <div key={u.id} className="admin-table-row" style={{ gridTemplateColumns: "1.4fr 120px 130px 90px 110px 90px 220px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserAvatar
                  name={u.name}
                  avatarColor={u.avatarColor}
                  avatarUrl={u.avatarUrl}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {u.name} <span style={{ fontWeight: 600, color: "var(--body)" }}>· UID {u.uid}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
                    {u.email && <div>{u.email}</div>}
                    <div style={{ color: "var(--purple)" }}>
                      高亮 {u._count.highlights} · 笔记 {u._count.notes}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>{login}</div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>{fmtLogin(u.lastLoginAt)}</div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>{u.memberships.length} 个</div>
              <div><span className="pill pill-purple">{level}</span></div>
              <div>
                <span className={`pill ${u.status === "BANNED" ? "pill-pink" : "pill-muted"}`}>
                  {statusLabel}
                </span>
              </div>
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
            </div>
          );
        })}

        {users.length === 0 && (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--body)", fontWeight: 600 }}>
            {q ? "没有找到匹配的真实注册用户" : "暂无真实注册用户；用户完成邮箱或 Apple 登录后会自动出现在这里"}
          </div>
        )}
      </div>
    </>
  );
}
