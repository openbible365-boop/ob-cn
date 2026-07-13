import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { PostComposer } from "@/components/site/PostComposer";
import { LikeButton } from "@/components/site/LikeButton";

export default async function CommunityWorkspacePage({
  params,
}: {
  params: Promise<{ communityId: string }>;
}) {
  const { communityId } = await params;
  const user = await getCurrentUser();

  const community = await db.community.findUnique({ where: { id: communityId } });
  if (!community) notFound();

  const [myCommunities, membership, posts, memberCount, members, topPosters] = await Promise.all([
    db.membership.findMany({
      where: { userId: user.id },
      include: { community: true },
      orderBy: { joinedAt: "asc" },
    }),
    db.membership.findUnique({ where: { userId_communityId: { userId: user.id, communityId } } }),
    db.post.findMany({
      where: { communityId, status: "VISIBLE" },
      include: { author: true, likes: { where: { userId: user.id } } },
      orderBy: { createdAt: "desc" },
    }),
    db.membership.count({ where: { communityId } }),
    db.membership.findMany({
      where: { communityId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
      take: 5,
    }),
    db.post.groupBy({
      by: ["authorId"],
      where: { communityId, status: "VISIBLE" },
      _count: { authorId: true },
      orderBy: { _count: { authorId: "desc" } },
      take: 3,
    }),
  ]);

  const posterUsers = await db.user.findMany({ where: { id: { in: topPosters.map((p) => p.authorId) } } });
  const posterMap = new Map(posterUsers.map((u) => [u.id, u]));

  return (
    <>
      <div style={{ flex: "none", width: 250, display: "flex", flexDirection: "column", background: "var(--white)", borderRight: "1px solid var(--line)", padding: "16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)", padding: "0 8px 10px" }}>我的群组</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {myCommunities.map((m) => (
            <Link
              key={m.communityId}
              href={`/community/${m.communityId}`}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 12,
                background: m.communityId === communityId ? "rgba(191,120,246,.14)" : "transparent",
              }}
            >
              <div style={{
                flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32,
                background: m.community.avatarColor, borderRadius: 9, fontSize: 13, fontWeight: 800,
              }}>
                {m.community.name.slice(0, 1)}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: m.communityId === communityId ? 800 : 700 }}>
                {m.community.name}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "14px 24px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{community.name}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{memberCount} 成员</div>
          <div style={{ flex: 1 }} />
          <Link
            href={`/community/${communityId}/events`}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--body)" }}
          >
            活动 →
          </Link>
        </div>

        <div style={{ flex: 1, padding: "14px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {membership ? (
            <PostComposer communityId={communityId} />
          ) : (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>你还不是该社群成员，暂无法发帖。</div>
          )}

          {posts.map((p) => (
            <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32,
                  background: p.author.avatarColor, borderRadius: 100, fontSize: 12, fontWeight: 800,
                }}>
                  {p.author.name.slice(0, 1)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {p.author.name} <span style={{ fontSize: 11, fontWeight: 600, color: "var(--body)", marginLeft: 6 }}>{p.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.75, marginBottom: 10 }}>{p.content}</div>
              {p.verseRef && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(191,120,246,.10)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--purple)" }}>{p.verseRef}</div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--body)" }}>
                <LikeButton postId={p.id} communityId={communityId} likeCount={p.likeCount} liked={p.likes.length > 0} />
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  {p.commentCount}
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--body)", padding: "24px 0" }}>还没有帖子，来发第一条吧。</div>
          )}
        </div>
      </div>

      <div style={{ flex: "none", width: 300, display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)", borderLeft: "1px solid var(--line)", padding: 16, overflow: "auto" }}>
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>成员 · {memberCount}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {members.map((m) => (
              <div key={m.userId} title={m.user.name} style={{
                display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
                background: m.user.avatarColor, borderRadius: 100, fontSize: 12, fontWeight: 800,
              }}>
                {m.user.name.slice(0, 1)}
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>本群活跃</div>
          {topPosters.map((p, i) => {
            const author = posterMap.get(p.authorId);
            return (
              <div key={p.authorId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: "var(--purple)", width: 14 }}>{i + 1}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{author?.name ?? "—"}</div>
                <div style={{ fontWeight: 600, color: "var(--body)" }}>{p._count.authorId} 帖</div>
              </div>
            );
          })}
          {topPosters.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--body)" }}>暂无发帖数据</div>
          )}
        </div>
      </div>
    </>
  );
}
