import { db } from "@/lib/db";
import { deletePost, hidePost, restorePost, deleteSensitiveWord } from "@/lib/actions/content";
import { AddSensitiveWordControl } from "@/components/AddSensitiveWordControl";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const STATUS_LABEL: Record<string, string> = { VISIBLE: "正常", HIDDEN: "已屏蔽", DELETED: "已删除" };
const STATUS_PILL: Record<string, string> = { VISIBLE: "pill-muted", HIDDEN: "pill-orange", DELETED: "pill-pink" };
const LEVEL_LABEL: Record<string, string> = { BLOCK: "拦截级", REVIEW: "待审级", LOG: "仅记录" };
const LEVEL_PILL: Record<string, string> = { BLOCK: "pill-pink", REVIEW: "pill-orange", LOG: "pill-muted" };

export default async function ContentManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [posts, words] = await Promise.all([
    db.post.findMany({
      where: q
        ? {
            OR: [
              { content: { contains: q, mode: "insensitive" } },
              { author: { name: { contains: q, mode: "insensitive" } } },
              { community: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      include: { author: true, community: true },
      orderBy: { createdAt: "desc" },
    }),
    db.sensitiveWord.findMany({ orderBy: [{ level: "asc" }, { word: "asc" }] }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div className="title">内容管理</div>
        <div className="meta">共 {posts.length} 条帖子</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/content">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索内容 / 作者 / 社群" defaultValue={q ?? ""} />
        </form>
      </div>

      <div className="card" style={{ borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto", marginBottom: 12 }}>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.6fr 130px 130px 90px 90px 100px 200px" }}>
          <div>内容</div><div>作者</div><div>社群</div><div>点赞</div><div>评论</div><div>状态</div><div>操作</div>
        </div>
        {posts.map((p) => (
          <div key={p.id} className="admin-table-row" style={{ gridTemplateColumns: "1.6fr 130px 130px 90px 90px 100px 200px" }}>
            <div style={{ fontWeight: 600, color: "var(--body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.content}
            </div>
            <div style={{ fontWeight: 700 }}>{p.author.name}</div>
            <div style={{ fontWeight: 600, color: "var(--body)" }}>{p.community.name}</div>
            <div style={{ fontWeight: 700 }}>{p.likeCount}</div>
            <div style={{ fontWeight: 700 }}>{p.commentCount}</div>
            <div><span className={`pill ${STATUS_PILL[p.status]}`}>{STATUS_LABEL[p.status]}</span></div>
            <div className="row-actions">
              {p.status === "VISIBLE" && (
                <>
                  <form action={hidePost}>
                    <input type="hidden" name="postId" value={p.id} />
                    <button type="submit" className="action-orange">屏蔽</button>
                  </form>
                  <form action={deletePost}>
                    <input type="hidden" name="postId" value={p.id} />
                    <ConfirmSubmitButton className="action-pink" confirmMessage="确定要删除这条帖子吗？">删除</ConfirmSubmitButton>
                  </form>
                </>
              )}
              {p.status !== "VISIBLE" && (
                <form action={restorePost}>
                  <input type="hidden" name="postId" value={p.id} />
                  <button type="submit" className="action-purple">恢复</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <div id="words" className="card" style={{ padding: "16px 18px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>敏感词库 · {words.length} 条</div>
          <AddSensitiveWordControl />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {words.map((w) => (
            <form key={w.id} action={deleteSensitiveWord} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="hidden" name="id" value={w.id} />
              <span className={`pill ${LEVEL_PILL[w.level]}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {w.word}
                <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 800, padding: 0 }} title={`删除（${LEVEL_LABEL[w.level]}）`}>
                  ×
                </button>
              </span>
            </form>
          ))}
        </div>
      </div>
    </>
  );
}
