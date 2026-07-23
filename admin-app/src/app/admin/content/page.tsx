import { db } from "@/lib/db";
import {
  deleteCommunityResource,
  deletePost,
  deletePostComment,
  deleteSensitiveWord,
  hideCommunityResource,
  hidePost,
  restoreCommunityResource,
  restorePost,
} from "@/lib/actions/content";
import { AddSensitiveWordControl } from "@/components/AddSensitiveWordControl";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const STATUS_LABEL: Record<string, string> = { VISIBLE: "正常", HIDDEN: "已屏蔽", DELETED: "已删除" };
const STATUS_PILL: Record<string, string> = { VISIBLE: "pill-muted", HIDDEN: "pill-orange", DELETED: "pill-pink" };
const LEVEL_LABEL: Record<string, string> = { BLOCK: "拦截级", REVIEW: "待审级", LOG: "仅记录" };
const LEVEL_PILL: Record<string, string> = { BLOCK: "pill-pink", REVIEW: "pill-orange", LOG: "pill-muted" };
const RESOURCE_STATUS_LABEL: Record<string, string> = { ACTIVE: "正常", HIDDEN: "已下架", DELETED: "已删除" };
const RESOURCE_TYPE_LABEL: Record<string, string> = { LINK: "链接", DOCUMENT: "文档", AUDIO: "音频", VIDEO: "视频", IMAGE: "图片" };
const POST_TYPE_LABEL: Record<string, string> = { POST: "图文", ARTICLE: "文章", NOTICE: "通知", MEDIA: "影音" };

export default async function ContentManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [posts, words, comments, resources] = await Promise.all([
    db.post.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
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
    db.postComment.findMany({
      where: q ? { content: { contains: q, mode: "insensitive" } } : undefined,
      include: { author: true, post: { include: { community: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.communityResource.findMany({
      where: q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { community: { name: { contains: q, mode: "insensitive" } } },
          { uploader: { name: { contains: q, mode: "insensitive" } } },
        ],
      } : undefined,
      include: { community: true, uploader: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div className="title">内容管理</div>
        <div className="meta">共 {posts.length} 条动态</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/content">
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
            <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 8 }}>
              {p.pinnedAt && <span className="pill pill-orange">置顶</span>}
              <span className={`pill ${p.postType === "NOTICE" ? "pill-orange" : p.postType === "MEDIA" ? "pill-purple" : "pill-muted"}`}>{POST_TYPE_LABEL[p.postType]}</span>
              <span style={{ minWidth: 0, fontWeight: 600, color: "var(--body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title ? `${p.title} · ` : ""}{p.content}
              </span>
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

      <div className="card" style={{ padding: "16px 18px", overflow: "auto", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>评论管理 · {comments.length} 条</div>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.8fr 120px 140px 120px" }}>
          <div>评论</div><div>作者</div><div>社群</div><div>操作</div>
        </div>
        {comments.map((comment) => (
          <div key={comment.id} className="admin-table-row" style={{ gridTemplateColumns: "1.8fr 120px 140px 120px" }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--body)", fontWeight: 600 }}>{comment.content}</div>
            <div style={{ fontWeight: 700 }}>{comment.author.name}</div>
            <div style={{ color: "var(--body)", fontWeight: 600 }}>{comment.post.community.name}</div>
            <form action={deletePostComment}>
              <input type="hidden" name="commentId" value={comment.id} />
              <ConfirmSubmitButton className="action-pink" confirmMessage="确定删除这条评论吗？">删除</ConfirmSubmitButton>
            </form>
          </div>
        ))}
        {comments.length === 0 && <div style={{ padding: "18px 0", color: "var(--body)", fontSize: 12 }}>暂无评论</div>}
      </div>

      <div className="card" style={{ padding: "16px 18px", overflow: "auto", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>社群资料管理 · {resources.length} 份</div>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.5fr 90px 140px 120px 100px 180px" }}>
          <div>资料</div><div>类型</div><div>社群</div><div>上传者</div><div>状态</div><div>操作</div>
        </div>
        {resources.map((resource) => (
          <div key={resource.id} className="admin-table-row" style={{ gridTemplateColumns: "1.5fr 90px 140px 120px 100px 180px" }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{resource.title}</div>
            <div><span className="pill pill-muted">{RESOURCE_TYPE_LABEL[resource.type]}</span></div>
            <div style={{ color: "var(--body)", fontWeight: 600 }}>{resource.community.name}</div>
            <div style={{ fontWeight: 700 }}>{resource.uploader.name}</div>
            <div><span className={`pill ${resource.status === "ACTIVE" ? "pill-muted" : resource.status === "HIDDEN" ? "pill-orange" : "pill-pink"}`}>{RESOURCE_STATUS_LABEL[resource.status]}</span></div>
            <div className="row-actions">
              {resource.status === "ACTIVE" ? <form action={hideCommunityResource}><input type="hidden" name="resourceId" value={resource.id} /><button className="action-orange">下架</button></form> : <form action={restoreCommunityResource}><input type="hidden" name="resourceId" value={resource.id} /><button className="action-purple">恢复</button></form>}
              {resource.status !== "DELETED" && <form action={deleteCommunityResource}><input type="hidden" name="resourceId" value={resource.id} /><ConfirmSubmitButton className="action-pink" confirmMessage="确定删除这份资料吗？">删除</ConfirmSubmitButton></form>}
            </div>
          </div>
        ))}
        {resources.length === 0 && <div style={{ padding: "18px 0", color: "var(--body)", fontSize: 12 }}>暂无社群资料</div>}
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
