import { db } from "@/lib/db";
import { SearchShortcut, ShortcutHint } from "@/components/ui/SearchShortcut";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";

const COMMUNITY_COLUMNS: Column[] = [
  { key: "community", label: "社群", width: "1.6fr" },
  { key: "owner", label: "群主", width: "100px" },
  { key: "members", label: "成员数", width: "80px", align: "right" },
  { key: "status", label: "状态", width: "90px" },
  { key: "created", label: "创建时间", width: "110px" },
  { key: "tier", label: "群组等级", width: "160px" },
  { key: "ops", label: "操作", width: "220px" },
];
import { formatDate, formatTier } from "@/lib/format";
import { warnCommunity, banCommunity, unbanCommunity, dissolveCommunity, changeCommunityTier } from "@/lib/actions/communities";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { auth } from "@/auth";

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const session = await auth();
  const canChangeTier = session?.user?.role === "SUPER_ADMIN";

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { abbreviation: { contains: q, mode: "insensitive" as const } },
          { owner: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : undefined;

  const [communities, total] = await Promise.all([
    db.community.findMany({
      where,
      include: {
        owner: true,
        parent: { select: { id: true, name: true } },
        _count: { select: { memberships: true, groups: true } },
      },
      orderBy: { createdAt: "asc" },
      ...pageQuery(page),
    }),
    // 统计跟随筛选条件，搜索后总数才对得上
    db.community.count({ where }),
  ]);
  const info = pageInfo(page, total);

  return (
    <>
      <SearchShortcut />
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

        <DataTable columns={COMMUNITY_COLUMNS} label="社群列表">
        <DataTable.Head />

        {communities.map((c) => {
          const statusLabel =
            c.status === "DISSOLVED" ? "已解散" : c.status === "BANNED" ? "已封禁" : "正常";

          return (
            <DataTable.Row key={c.id} tone={c.status !== "ACTIVE" ? "err" : c.warningCount > 0 ? "warn" : undefined}>
              <DataTable.Cell>
                <div className="entity-cell">
                  <span className="entity-mark" style={{ background: c.avatarColor }}>{c.name.slice(0, 1)}</span>
                  <span className="entity-name" title={c.name}>{c.name}</span>
                  <Badge>简称 · {c.abbreviation}</Badge>
                  {c.parent ? (
                    <Badge>群组 · {c.parent.name}</Badge>
                  ) : c._count.groups > 0 ? (
                    <Badge tone="info">{c._count.groups} 个群组</Badge>
                  ) : null}
                  {c.isOfficial ? <Badge tone="warn">官方</Badge> : null}
                  {c.warningCount > 0 ? <Badge tone="warn">已警告 {c.warningCount} 次</Badge> : null}
                </div>
              </DataTable.Cell>
              <DataTable.Cell truncate title={c.owner?.name ?? "—"}>{c.owner?.name ?? "—"}</DataTable.Cell>
              <DataTable.Cell align="right"><strong>{c._count.memberships}</strong></DataTable.Cell>
              <DataTable.Cell>
                <Badge tone={c.status === "ACTIVE" ? "ok" : "err"}>{statusLabel}</Badge>
              </DataTable.Cell>
              <DataTable.Cell>{formatDate(c.createdAt)}</DataTable.Cell>
              <DataTable.Cell>
                {c.isOfficial || c.parent || !canChangeTier ? (
                  <Badge tone="info">{formatTier(c.tier, c.tierPriceCents)}</Badge>
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
              </DataTable.Cell>
              <DataTable.Cell>
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
              </DataTable.Cell>
            </DataTable.Row>
          );
        })}

        {communities.length === 0 && (
          <EmptyState
            title={q ? "没有找到匹配的社群" : "还没有社群"}
            hint={q ? "换个关键词试试，或清除搜索条件" : "用户在 App 端创建社群后会出现在这里"}
          />
        )}
        </DataTable>

        <Pagination info={info} basePath="/admin/communities" params={{ q }} />
      </div>
    </>
  );
}
