import { db } from "@/lib/db";
import { SearchShortcut, ShortcutHint } from "@/components/ui/SearchShortcut";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, type Tone } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";

const POST_COLUMNS: Column[] = [
  { key: "content", label: "内容", width: "1.6fr" },
  { key: "author", label: "作者", width: "120px" },
  { key: "community", label: "社群", width: "130px" },
  { key: "likes", label: "点赞", width: "70px", align: "right" },
  { key: "comments", label: "评论", width: "70px", align: "right" },
  { key: "status", label: "状态", width: "90px" },
  { key: "ops", label: "操作", width: "200px" },
];

const COMMENT_COLUMNS: Column[] = [
  { key: "content", label: "评论", width: "1.8fr" },
  { key: "author", label: "作者", width: "120px" },
  { key: "community", label: "社群", width: "140px" },
  { key: "ops", label: "操作", width: "120px" },
];

const RESOURCE_COLUMNS: Column[] = [
  { key: "title", label: "资料", width: "1.5fr" },
  { key: "kind", label: "类型", width: "90px" },
  { key: "community", label: "社群", width: "140px" },
  { key: "uploader", label: "上传者", width: "120px" },
  { key: "status", label: "状态", width: "100px" },
  { key: "ops", label: "操作", width: "180px" },
];

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
// 语义映射：可见=正常，已屏蔽=告警，已删除=错误
const STATUS_TONE: Record<string, Tone> = { VISIBLE: "ok", HIDDEN: "warn", DELETED: "err" };
const LEVEL_LABEL: Record<string, string> = { BLOCK: "拦截级", REVIEW: "待审级", LOG: "仅记录" };
const LEVEL_PILL: Record<string, string> = { BLOCK: "pill-pink", REVIEW: "pill-orange", LOG: "pill-muted" };
const RESOURCE_STATUS_LABEL: Record<string, string> = { ACTIVE: "正常", HIDDEN: "已下架", DELETED: "已删除" };
const RESOURCE_TYPE_LABEL: Record<string, string> = { LINK: "链接", DOCUMENT: "文档", AUDIO: "音频", VIDEO: "视频", IMAGE: "图片" };
const POST_TYPE_LABEL: Record<string, string> = { POST: "图文", ARTICLE: "文章", NOTICE: "通知", MEDIA: "影音" };

export default async function ContentManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const postWhere = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { content: { contains: q, mode: "insensitive" as const } },
          { author: { name: { contains: q, mode: "insensitive" as const } } },
          { community: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : undefined;

  const [posts, postTotal, words, comments, resources] = await Promise.all([
    db.post.findMany({
      where: postWhere,
      include: { author: true, community: true },
      orderBy: { createdAt: "desc" },
      ...pageQuery(page),
    }),
    db.post.count({ where: postWhere }),
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
  const info = pageInfo(page, postTotal);

  return (
    <>
      <SearchShortcut />
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
        <DataTable columns={POST_COLUMNS} label="社群动态列表">
        {posts.map((p) => (
          <DataTable.Row key={p.id}>
            <DataTable.Cell>
              <div className="entity-cell">
                {p.pinnedAt && <Badge tone="warn">置顶</Badge>}
                <Badge tone={p.postType === "NOTICE" ? "warn" : p.postType === "MEDIA" ? "info" : "neutral"}>
                  {POST_TYPE_LABEL[p.postType]}
                </Badge>
                <span className="entity-name" title={`${p.title ? p.title + " · " : ""}${p.content}`}>
                  {p.title ? `${p.title} · ` : ""}{p.content}
                </span>
              </div>
            </DataTable.Cell>
            <DataTable.Cell truncate title={p.author.name}><strong>{p.author.name}</strong></DataTable.Cell>
            <DataTable.Cell truncate title={p.community.name}>{p.community.name}</DataTable.Cell>
            <DataTable.Cell align="right"><strong>{p.likeCount}</strong></DataTable.Cell>
            <DataTable.Cell align="right"><strong>{p.commentCount}</strong></DataTable.Cell>
            <DataTable.Cell>
              <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            </DataTable.Cell>
            <DataTable.Cell>
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
            </DataTable.Cell>
          </DataTable.Row>
        ))}

        {posts.length === 0 && (
          <EmptyState
            title={q ? "没有找到匹配的动态" : "还没有社群动态"}
            hint={q ? "换个关键词试试，或清除搜索条件" : "用户在社群里发布动态后会出现在这里"}
          />
        )}
        </DataTable>

        <Pagination info={info} basePath="/admin/content" params={{ q }} />
      </div>

      <div className="card" style={{ padding: "16px 18px", overflow: "auto", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>评论管理 · {comments.length} 条</div>
        <DataTable columns={COMMENT_COLUMNS} label="评论列表">
        {comments.map((comment) => (
          <DataTable.Row key={comment.id}>
            <DataTable.Cell truncate title={comment.content}>{comment.content}</DataTable.Cell>
            <DataTable.Cell truncate title={comment.author.name}><strong>{comment.author.name}</strong></DataTable.Cell>
            <DataTable.Cell truncate title={comment.post.community.name}>{comment.post.community.name}</DataTable.Cell>
            <DataTable.Cell>
            <form action={deletePostComment}>
              <input type="hidden" name="commentId" value={comment.id} />
              <ConfirmSubmitButton className="action-pink" confirmMessage="确定删除这条评论吗？">删除</ConfirmSubmitButton>
            </form>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
        {comments.length === 0 && (
          <EmptyState title="暂无评论" hint="用户在社群动态下发表评论后会出现在这里" />
        )}
        </DataTable>
      </div>

      <div className="card" style={{ padding: "16px 18px", overflow: "auto", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>社群资料管理 · {resources.length} 份</div>
        <DataTable columns={RESOURCE_COLUMNS} label="社群资料列表">
        {resources.map((resource) => (
          <DataTable.Row key={resource.id}>
            <DataTable.Cell truncate title={resource.title}><strong>{resource.title}</strong></DataTable.Cell>
            <DataTable.Cell><Badge>{RESOURCE_TYPE_LABEL[resource.type]}</Badge></DataTable.Cell>
            <DataTable.Cell truncate title={resource.community.name}>{resource.community.name}</DataTable.Cell>
            <DataTable.Cell truncate title={resource.uploader.name}><strong>{resource.uploader.name}</strong></DataTable.Cell>
            <DataTable.Cell>
              <Badge tone={resource.status === "ACTIVE" ? "ok" : resource.status === "HIDDEN" ? "warn" : "err"}>
                {RESOURCE_STATUS_LABEL[resource.status]}
              </Badge>
            </DataTable.Cell>
            <DataTable.Cell>
            <div className="row-actions">
              {resource.status === "ACTIVE" ? <form action={hideCommunityResource}><input type="hidden" name="resourceId" value={resource.id} /><button className="action-orange">下架</button></form> : <form action={restoreCommunityResource}><input type="hidden" name="resourceId" value={resource.id} /><button className="action-purple">恢复</button></form>}
              {resource.status !== "DELETED" && <form action={deleteCommunityResource}><input type="hidden" name="resourceId" value={resource.id} /><ConfirmSubmitButton className="action-pink" confirmMessage="确定删除这份资料吗？">删除</ConfirmSubmitButton></form>}
            </div>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
        {resources.length === 0 && (
          <EmptyState title="暂无社群资料" hint="群主或管理员上传资料后会出现在这里，可在此下架或删除" />
        )}
        </DataTable>
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
