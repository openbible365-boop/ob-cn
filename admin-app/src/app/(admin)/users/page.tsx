import { db } from "@/lib/db";
import { deriveUserLevel, formatLoginMethods } from "@/lib/format";
import { muteUser, unbanUser } from "@/lib/actions/users";
import { BanUserControl } from "@/components/BanUserControl";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where: q
        ? { name: { contains: q, mode: "insensitive" } }
        : undefined,
      include: {
        authAccounts: true,
        memberships: { include: { community: true } },
      },
      orderBy: { uid: "asc" },
    }),
    db.user.count(),
  ]);

  return (
    <>
      <div className="admin-header">
        <div className="title">用户管理</div>
        <div className="meta">共 {total} 名注册用户</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/users">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索用户名" defaultValue={q ?? ""} />
        </form>
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.2fr 150px 120px 110px 110px 220px" }}>
          <div>用户</div><div>登录方式</div><div>所属群组</div><div>群用户级别</div><div>状态</div><div>操作</div>
        </div>

        {users.map((u) => {
          const level = deriveUserLevel(u.memberships.map((m) => m.community.tier));
          const login = formatLoginMethods(u.authAccounts.map((a) => a.provider));
          const statusLabel =
            u.status === "BANNED" ? "封禁中" : u.status === "MUTED" ? "禁言中" : "正常";

          return (
            <div key={u.id} className="admin-table-row" style={{ gridTemplateColumns: "1.2fr 150px 120px 110px 110px 220px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, background: u.avatarColor, borderRadius: "100%",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {u.name.slice(0, 1)}
                </div>
                <div style={{ fontWeight: 700 }}>
                  {u.name} <span style={{ fontWeight: 600, color: "var(--body)" }}>· UID {u.uid}</span>
                </div>
              </div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>{login}</div>
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
      </div>
    </>
  );
}
