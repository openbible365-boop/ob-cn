import { db } from "@/lib/db";
import { formatTier } from "@/lib/format";
import { warnCommunity, banCommunity, unbanCommunity, dissolveCommunity, changeCommunityTier } from "@/lib/actions/communities";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { auth } from "@/auth";

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await auth();
  const canChangeTier = session?.user?.role === "SUPER_ADMIN";

  const [communities, total] = await Promise.all([
    db.community.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { abbreviation: { contains: q, mode: "insensitive" } },
              { owner: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      include: {
        owner: true,
        parent: { select: { id: true, name: true } },
        _count: { select: { memberships: true, groups: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.community.count(),
  ]);

  return (
    <>
      <div className="admin-header">
        <div className="title">社群管理</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/communities">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索社群 / 简称 / 群主" defaultValue={q ?? ""} />
        </form>
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>全网分社群清单 · {total} 个</div>
          <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
            解散前二次确认并通知群主 · 数据按合规归档
          </div>
        </div>

        <div className="admin-table-head" style={{ gridTemplateColumns: "1.4fr 100px 90px 100px 110px 110px 220px" }}>
          <div>社群</div><div>群主</div><div>成员数</div><div>状态</div><div>创建时间</div><div>群组等级</div><div>操作</div>
        </div>

        {communities.map((c) => {
          const statusLabel =
            c.status === "DISSOLVED" ? "已解散" : c.status === "BANNED" ? "已封禁" : "正常";

          return (
            <div key={c.id} className="admin-table-row" style={{ gridTemplateColumns: "1.4fr 100px 90px 100px 110px 110px 220px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, background: c.avatarColor, borderRadius: 8,
                  fontSize: 11, fontWeight: 800,
                }}>
                  {c.name.slice(0, 1)}
                </div>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <span className="pill pill-muted">简称 · {c.abbreviation}</span>
                {c.parent ? (
                  <span className="pill pill-muted">群组 · {c.parent.name}</span>
                ) : c._count.groups > 0 ? (
                  <span className="pill pill-purple">{c._count.groups} 个群组</span>
                ) : null}
                {c.isOfficial ? <span className="pill pill-yellow">官方</span> : null}
                {c.warningCount > 0 ? (
                  <span className="pill pill-orange">已警告 {c.warningCount} 次</span>
                ) : null}
              </div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>{c.owner?.name ?? "—"}</div>
              <div style={{ fontWeight: 700 }}>{c._count.memberships}</div>
              <div>
                <span className={`pill ${c.status === "ACTIVE" ? "pill-muted" : "pill-pink"}`}>{statusLabel}</span>
              </div>
              <div style={{ fontWeight: 600, color: "var(--body)" }}>
                {c.createdAt.toISOString().slice(0, 10)}
              </div>
              <div>
                {c.isOfficial || c.parent || !canChangeTier ? (
                  <span className="pill pill-purple">{formatTier(c.tier, c.tierPriceCents)}</span>
                ) : (
                  <form action={changeCommunityTier} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="hidden" name="communityId" value={c.id} />
                    <select name="tier" defaultValue={c.tier} aria-label={`${c.name}会员方案`} style={{ height: 28, border: "1px solid var(--line)", borderRadius: 8, background: "var(--white)", fontSize: 11, fontWeight: 700 }}>
                      <option value="BASIC_FREE">初阶 免费</option>
                      <option value="MID">中阶 ¥30</option>
                      <option value="HIGH">高阶 ¥98</option>
                    </select>
                    <ConfirmSubmitButton className="action-purple" confirmMessage={`确认调整「${c.name}」的会员方案吗？此操作只修改权益，不会自动扣费。`}>保存</ConfirmSubmitButton>
                  </form>
                )}
              </div>
              <div className="row-actions">
                {c.status === "DISSOLVED" ? (
                  <span className="action-body">已解散</span>
                ) : (
                  <>
                    <form action={warnCommunity}>
                      <input type="hidden" name="communityId" value={c.id} />
                      <button type="submit" className="action-orange">警告</button>
                    </form>
                    {c.status === "BANNED" ? (
                      <form action={unbanCommunity}>
                        <input type="hidden" name="communityId" value={c.id} />
                        <button type="submit" className="action-purple">解封</button>
                      </form>
                    ) : (
                      <form action={banCommunity}>
                        <input type="hidden" name="communityId" value={c.id} />
                        <button type="submit" className="action-pink">封禁</button>
                      </form>
                    )}
                    <form action={dissolveCommunity}>
                      <input type="hidden" name="communityId" value={c.id} />
                      <ConfirmSubmitButton
                        className="action-pink"
                        confirmMessage={`确定要解散「${c.name}」吗？此操作将通知群主，且不可撤销。`}
                      >
                        解散
                      </ConfirmSubmitButton>
                    </form>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
