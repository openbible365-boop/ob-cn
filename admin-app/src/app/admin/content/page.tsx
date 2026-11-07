import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { SearchShortcut } from "@/components/ui/SearchShortcut";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, type Tone } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime } from "@/lib/format";
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

// 内容管理：按「动态 / 评论 / 资料 / 敏感词」分标签页，每次只看一类。
// 每类有自己的数量、状态筛选、搜索与分页（以前四大块堆在一页、一个搜索框管全部）。

type Tab = "posts" | "comments" | "resources" | "words";
const TABS: { key: Tab; label: string }[] = [
  { key: "posts", label: "动态" },
  { key: "comments", label: "评论" },
  { key: "resources", label: "社群资料" },
  { key: "words", label: "敏感词" },
];

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  posts: "搜索标题 / 内容 / 作者 / 社群",
  comments: "搜索评论内容 / 作者",
  resources: "搜索资料标题 / 社群 / 上传者",
  words: "搜索敏感词",
};

const POST_COLUMNS: Column[] = [
  { key: "content", label: "内容", width: "1.8fr" },
  { key: "author", label: "作者", width: "120px" },
  { key: "community", label: "社群", width: "130px" },
  { key: "stats", label: "赞 / 评", width: "80px", align: "right" },
  { key: "time", label: "发布时间", width: "140px" },
  { key: "status", label: "状态", width: "80px" },
  { key: "ops", label: "操作", width: "150px" },
];

const COMMENT_COLUMNS: Column[] = [
  { key: "content", label: "评论", width: "1.6fr" },
  { key: "post", label: "所在动态", width: "1fr" },
  { key: "author", label: "作者", width: "120px" },
  { key: "time", label: "时间", width: "140px" },
  { key: "ops", label: "操作", width: "80px" },
];

const RESOURCE_COLUMNS: Column[] = [
  { key: "title", label: "资料", width: "1.6fr" },
  { key: "kind", label: "类型", width: "80px" },
  { key: "community", label: "社群", width: "130px" },
  { key: "uploader", label: "上传者", width: "120px" },
  { key: "status", label: "状态", width: "80px" },
  { key: "ops", label: "操作", width: "150px" },
];

const POST_STATUS: { key: string; label: string; tone: Tone }[] = [
  { key: "VISIBLE", label: "正常", tone: "ok" },
  { key: "HIDDEN", label: "已屏蔽", tone: "warn" },
  { key: "DELETED", label: "已删除", tone: "err" },
];
const RESOURCE_STATUS: { key: string; label: string; tone: Tone }[] = [
  { key: "ACTIVE", label: "正常", tone: "ok" },
  { key: "HIDDEN", label: "已下架", tone: "warn" },
  { key: "DELETED", label: "已删除", tone: "err" },
];
const POST_TYPE_LABEL: Record<string, string> = { POST: "图文", ARTICLE: "文章", NOTICE: "通知", MEDIA: "影音", PRAYER: "代祷" };
const RESOURCE_TYPE_LABEL: Record<string, string> = { LINK: "链接", DOCUMENT: "文档", AUDIO: "音频", VIDEO: "视频", IMAGE: "图片" };
const WORD_LEVELS: { key: string; label: string; hint: string; pill: string }[] = [
  { key: "BLOCK", label: "拦截级", hint: "含这些词的内容直接拦截，发不出去", pill: "pill-pink" },
  { key: "REVIEW", label: "待审级", hint: "含这些词的内容进入「内容审核」等待人工处理", pill: "pill-orange" },
  { key: "LOG", label: "仅记录", hint: "不拦截，只记录命中情况", pill: "pill-muted" },
];

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return `/admin/content${query ? `?${query}` : ""}`;
}

function Segmented({ items, active, hrefFor }: {
  items: { key: string; label: string; count?: number }[];
  active: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div style={{ display: "inline-flex", flexWrap: "wrap", background: "var(--surface-2)", borderRadius: 100, padding: 3, gap: 2 }}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Link
            key={item.key}
            href={hrefFor(item.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 14px", borderRadius: 100,
              fontSize: 12, fontWeight: on ? 700 : 600,
              color: on ? "var(--ink)" : "var(--body)",
              background: on ? "var(--white)" : "transparent",
              boxShadow: on ? "var(--shadow-card)" : "none",
            }}
          >
            {item.label}
            {item.count !== undefined && (
              <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default async function ContentManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "posts";
  const q = params.q?.trim() || undefined;
  const status = params.status || "all";
  const page = parsePage(params.page);

  // 标签上的数量（总数，不受搜索影响）+ 需要关注的数量
  const [postCount, commentCount, resourceCount, wordCount, hiddenPosts, hiddenResources] = await Promise.all([
    db.post.count({ where: { status: { not: "DELETED" }, postType: { not: "PRAYER" } } }),
    db.postComment.count(),
    db.communityResource.count({ where: { status: { not: "DELETED" } } }),
    db.sensitiveWord.count(),
    db.post.count({ where: { status: "HIDDEN", postType: { not: "PRAYER" } } }),
    db.communityResource.count({ where: { status: "HIDDEN" } }),
  ]);
  const tabCounts: Record<Tab, number> = { posts: postCount, comments: commentCount, resources: resourceCount, words: wordCount };

  const hrefFor = (overrides: Record<string, string | undefined>) =>
    buildHref({ tab, q, status: status === "all" ? undefined : status, ...overrides });

  let body: React.ReactNode = null;
  let total = 0;

  if (tab === "posts") {
    const where: Prisma.PostWhereInput = {
      postType: { not: "PRAYER" }, // 代祷在「祷告墙」页单独管理
      ...(status !== "all" ? { status: status as "VISIBLE" | "HIDDEN" | "DELETED" } : { status: { not: "DELETED" } }),
      ...(q ? { OR: [{ title: ci(q) }, { content: ci(q) }, { author: { name: ci(q) } }, { community: { name: ci(q) } }] } : {}),
    };
    const [posts, count] = await Promise.all([
      db.post.findMany({ where, include: { author: true, community: true }, orderBy: { createdAt: "desc" }, ...pageQuery(page) }),
      db.post.count({ where }),
    ]);
    total = count;
    body = (
      <DataTable columns={POST_COLUMNS} label="社群动态列表">
        <DataTable.Head />
        {posts.map((p) => {
          const st = POST_STATUS.find((s) => s.key === p.status);
          return (
            <DataTable.Row key={p.id}>
              <DataTable.Cell>
                <div className="entity-cell">
                  {p.pinnedAt && <Badge tone="warn">置顶</Badge>}
                  <Badge tone={p.postType === "NOTICE" ? "warn" : p.postType === "MEDIA" ? "info" : "neutral"}>
                    {POST_TYPE_LABEL[p.postType] ?? p.postType}
                  </Badge>
                  <span className="entity-name" title={`${p.title ? p.title + " · " : ""}${p.content}`}>
                    {p.title ? `${p.title} · ` : ""}{p.content}
                  </span>
                </div>
              </DataTable.Cell>
              <DataTable.Cell truncate title={p.author.name}><strong>{p.author.name}</strong></DataTable.Cell>
              <DataTable.Cell truncate title={p.community.name}>{p.community.name}</DataTable.Cell>
              <DataTable.Cell align="right">{p.likeCount} / {p.commentCount}</DataTable.Cell>
              <DataTable.Cell>{formatDateTime(p.createdAt)}</DataTable.Cell>
              <DataTable.Cell><Badge tone={st?.tone}>{st?.label}</Badge></DataTable.Cell>
              <DataTable.Cell>
                <div className="row-actions">
                  {p.status === "VISIBLE" ? (
                    <>
                      <form action={hidePost}>
                        <input type="hidden" name="postId" value={p.id} />
                        <button type="submit" className="action-orange">屏蔽</button>
                      </form>
                      <form action={deletePost}>
                        <input type="hidden" name="postId" value={p.id} />
                        <ConfirmSubmitButton className="action-pink" confirmMessage="确定要删除这条动态吗？">删除</ConfirmSubmitButton>
                      </form>
                    </>
                  ) : (
                    <form action={restorePost}>
                      <input type="hidden" name="postId" value={p.id} />
                      <button type="submit" className="action-purple">恢复</button>
                    </form>
                  )}
                </div>
              </DataTable.Cell>
            </DataTable.Row>
          );
        })}
        {posts.length === 0 && (
          <EmptyState
            title={q || status !== "all" ? "没有符合条件的动态" : "还没有社群动态"}
            hint={q || status !== "all" ? "换个关键词或状态试试" : "用户在社群里发布动态后会出现在这里"}
          />
        )}
      </DataTable>
    );
  } else if (tab === "comments") {
    const where: Prisma.PostCommentWhereInput = q ? { OR: [{ content: ci(q) }, { author: { name: ci(q) } }] } : {};
    const [comments, count] = await Promise.all([
      db.postComment.findMany({
        where,
        include: { author: true, post: { select: { title: true, content: true, community: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        ...pageQuery(page),
      }),
      db.postComment.count({ where }),
    ]);
    total = count;
    body = (
      <DataTable columns={COMMENT_COLUMNS} label="评论列表">
        <DataTable.Head />
        {comments.map((comment) => {
          const postLabel = comment.post.title || comment.post.content;
          return (
            <DataTable.Row key={comment.id}>
              <DataTable.Cell truncate title={comment.content}>{comment.content}</DataTable.Cell>
              <DataTable.Cell truncate title={`${comment.post.community.name} · ${postLabel}`}>
                <span style={{ color: "var(--muted)" }}>{comment.post.community.name} · </span>{postLabel}
              </DataTable.Cell>
              <DataTable.Cell truncate title={comment.author.name}><strong>{comment.author.name}</strong></DataTable.Cell>
              <DataTable.Cell>{formatDateTime(comment.createdAt)}</DataTable.Cell>
              <DataTable.Cell>
                <form action={deletePostComment}>
                  <input type="hidden" name="commentId" value={comment.id} />
                  <ConfirmSubmitButton className="action-pink" confirmMessage="确定删除这条评论吗？">删除</ConfirmSubmitButton>
                </form>
              </DataTable.Cell>
            </DataTable.Row>
          );
        })}
        {comments.length === 0 && (
          <EmptyState title={q ? "没有找到匹配的评论" : "暂无评论"} hint={q ? "换个关键词试试" : "用户在社群动态下发表评论后会出现在这里"} />
        )}
      </DataTable>
    );
  } else if (tab === "resources") {
    const where: Prisma.CommunityResourceWhereInput = {
      ...(status !== "all" ? { status: status as "ACTIVE" | "HIDDEN" | "DELETED" } : { status: { not: "DELETED" } }),
      ...(q ? { OR: [{ title: ci(q) }, { community: { name: ci(q) } }, { uploader: { name: ci(q) } }] } : {}),
    };
    const [resources, count] = await Promise.all([
      db.communityResource.findMany({ where, include: { community: true, uploader: true }, orderBy: { createdAt: "desc" }, ...pageQuery(page) }),
      db.communityResource.count({ where }),
    ]);
    total = count;
    body = (
      <DataTable columns={RESOURCE_COLUMNS} label="社群资料列表">
        <DataTable.Head />
        {resources.map((resource) => {
          const st = RESOURCE_STATUS.find((s) => s.key === resource.status);
          return (
            <DataTable.Row key={resource.id}>
              <DataTable.Cell truncate title={resource.title}><strong>{resource.title}</strong></DataTable.Cell>
              <DataTable.Cell><Badge>{RESOURCE_TYPE_LABEL[resource.type] ?? resource.type}</Badge></DataTable.Cell>
              <DataTable.Cell truncate title={resource.community.name}>{resource.community.name}</DataTable.Cell>
              <DataTable.Cell truncate title={resource.uploader.name}>{resource.uploader.name}</DataTable.Cell>
              <DataTable.Cell><Badge tone={st?.tone}>{st?.label}</Badge></DataTable.Cell>
              <DataTable.Cell>
                <div className="row-actions">
                  {resource.status === "ACTIVE" ? (
                    <form action={hideCommunityResource}>
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <button type="submit" className="action-orange">下架</button>
                    </form>
                  ) : (
                    <form action={restoreCommunityResource}>
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <button type="submit" className="action-purple">恢复</button>
                    </form>
                  )}
                  {resource.status !== "DELETED" && (
                    <form action={deleteCommunityResource}>
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <ConfirmSubmitButton className="action-pink" confirmMessage="确定删除这份资料吗？">删除</ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              </DataTable.Cell>
            </DataTable.Row>
          );
        })}
        {resources.length === 0 && (
          <EmptyState
            title={q || status !== "all" ? "没有符合条件的资料" : "暂无社群资料"}
            hint={q || status !== "all" ? "换个关键词或状态试试" : "群主或管理员上传资料后会出现在这里"}
          />
        )}
      </DataTable>
    );
  } else {
    const words = await db.sensitiveWord.findMany({
      where: q ? { word: ci(q) } : undefined,
      orderBy: [{ level: "asc" }, { word: "asc" }],
    });
    total = words.length;
    body = (
      <div style={{ display: "grid", gap: 16 }}>
        {WORD_LEVELS.map((level) => {
          const items = words.filter((w) => w.level === level.key);
          return (
            <section key={level.key}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>{level.label}</strong>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{items.length} 个 · {level.hint}</span>
              </div>
              {items.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{q ? "没有匹配的词" : "暂无"}</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {items.map((w) => (
                    <form key={w.id} action={deleteSensitiveWord}>
                      <input type="hidden" name="id" value={w.id} />
                      <span className={`pill ${level.pill}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {w.word}
                        <button
                          type="submit"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 800, padding: 0 }}
                          title="删除这个词"
                          aria-label={`删除敏感词 ${w.word}`}
                        >
                          ×
                        </button>
                      </span>
                    </form>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  const info = pageInfo(page, total);
  const statusOptions = tab === "posts" ? POST_STATUS : tab === "resources" ? RESOURCE_STATUS : null;

  return (
    <>
      <SearchShortcut />
      <div className="admin-header">
        <div className="title">社群内容</div>
        <div className="meta">
          社群里用户发布的内容
          {hiddenPosts + hiddenResources > 0 ? ` · 屏蔽中：动态 ${hiddenPosts} 条、资料 ${hiddenResources} 份` : ""}
        </div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/content">
          <input type="hidden" name="tab" value={tab} />
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder={SEARCH_PLACEHOLDER[tab]} defaultValue={q ?? ""} />
        </form>
      </div>

      {/* 一级：内容类型；切换时清空搜索与状态 */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Segmented
          items={TABS.map((t) => ({ key: t.key, label: t.label, count: tabCounts[t.key] }))}
          active={tab}
          hrefFor={(key) => buildHref({ tab: key })}
        />
        {/* 二级：状态筛选（动态、资料才有） */}
        {statusOptions && (
          <Segmented
            items={[{ key: "all", label: "全部" }, ...statusOptions.map((s) => ({ key: s.key, label: s.label }))]}
            active={status}
            hrefFor={(key) => hrefFor({ status: key === "all" ? undefined : key, page: undefined })}
          />
        )}
        {tab === "words" && (
          <div style={{ marginLeft: "auto", display: "flex" }}>
            <AddSensitiveWordControl />
          </div>
        )}
      </div>

      {q && (
        <div style={{ fontSize: 12, color: "var(--body)", marginBottom: 10 }}>
          搜索「{q}」共 {total} 条结果 · <Link href={hrefFor({ q: undefined, page: undefined })} style={{ color: "var(--purple)" }}>清除搜索</Link>
        </div>
      )}

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        {body}
        {tab !== "words" && (
          <Pagination
            info={info}
            basePath="/admin/content"
            params={{ tab, q, status: status === "all" ? undefined : status }}
          />
        )}
      </div>
    </>
  );
}
