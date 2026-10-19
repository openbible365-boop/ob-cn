import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import {
  CommunitySheet,
  ConfirmSheet,
  EventComposer,
  GroupComposer,
  PostComposer,
  ResourceComposer,
} from "./WorkspaceComposers";
import { resolveApiUrl, resolveAvatarUrl } from "../../data/api";
import type { CommunityJoinRequest } from "../../data/community";
import { addPrayer } from "../../data/prayers";
import {
  fetchCommunityPosts,
  fetchPostComments,
  type CommunityWorkspace,
  type WorkspaceActionInput,
  type WorkspaceComment,
  type WorkspaceEvent,
  type WorkspacePost,
  type WorkspaceResource,
} from "../../data/community-workspace";

type PanelProps = {
  workspace: CommunityWorkspace;
  busy: boolean;
  runAction: (input: WorkspaceActionInput) => Promise<boolean>;
};

// 各栏目顶部统一的新建入口。
// 图标跟动作语义走：发布 = 笔、邀请 = 人、添加资料 = 回形针，不再一律用编辑笔
function PanelCreateButton({ label, icon = "edit", onClick }: { label: string; icon?: string; onClick: () => void }) {
  return (
    <button type="button" className="community-panel-create" onClick={onClick}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function readableTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function roleLabel(role: "OWNER" | "ADMIN" | "MEMBER") {
  return role === "OWNER" ? "群主" : role === "ADMIN" ? "管理员" : "成员";
}

function resourceTypeLabel(type: WorkspaceResource["type"]) {
  return {
    LINK: "链接",
    DOCUMENT: "文档",
    AUDIO: "音频",
    VIDEO: "视频",
    IMAGE: "图片",
    TEXT: "文本",
    OTHER: "文件",
  }[type];
}

function knowledgeStatus(resource: WorkspaceResource) {
  if (resource.knowledgeStatus === "PARSING") return { label: "正在解析", className: "is-parsing" };
  if (resource.knowledgeStatus === "INDEXED") return { label: "已加入知识库", className: "is-indexed" };
  if (resource.knowledgeStatus === "FAILED") return { label: "解析失败", className: "is-failed" };
  return { label: "需要重新索引", className: "is-reindex" };
}

function readableFileSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

type ResourceFilter = "ALL" | "DOCUMENT" | "MEDIA" | "LINK";

function resourceIconName(resource: WorkspaceResource) {
  if (resource.type === "AUDIO") return "volume-2";
  if (resource.type === "VIDEO") return "play";
  if (resource.type === "IMAGE") return "image";
  if (resource.type === "TEXT") return "edit";
  return "book";
}

function resourceDisplayTitle(resource: WorkspaceResource) {
  const rawTitle = resource.title.trim();
  const rawFileName = resource.fileName?.trim() ?? "";
  const opaqueName = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:\.[a-z0-9]+)?$/iu;

  if (rawTitle && !opaqueName.test(rawTitle)) return rawTitle;
  if (rawFileName && !opaqueName.test(rawFileName)) {
    return rawFileName.replace(/\.[^.]+$/u, "");
  }
  return `${resourceTypeLabel(resource.type)}资料`;
}

function matchesResourceFilter(
  resource: WorkspaceResource,
  filter: ResourceFilter,
) {
  if (filter === "ALL") return true;
  if (filter === "DOCUMENT") {
    return resource.type === "DOCUMENT" || resource.type === "TEXT";
  }
  if (filter === "MEDIA") {
    return ["IMAGE", "AUDIO", "VIDEO"].includes(resource.type);
  }
  return resource.type === "LINK";
}

export function CommunitySharePanel({ workspace, busy, runAction }: PanelProps) {
  const [commentPostId, setCommentPostId] = useState("");
  const [comment, setComment] = useState("");
  const [menuPostId, setMenuPostId] = useState("");
  const [reportPostId, setReportPostId] = useState("");
  const [reportReason, setReportReason] = useState("不当内容");
  const [composerOpen, setComposerOpen] = useState(false);
  // 工作台只带最新两条评论，展开后按游标向后端继续取。
  const [expandedComments, setExpandedComments] = useState<Record<string, WorkspaceComment[]>>({});
  const [commentCursors, setCommentCursors] = useState<Record<string, string | null>>({});
  const [loadingComments, setLoadingComments] = useState("");
  const [commentError, setCommentError] = useState("");
  // 首屏之后的动态按游标追加，工作台刷新时清空重来。
  const [morePosts, setMorePosts] = useState<WorkspacePost[]>([]);
  // undefined 表示还没翻过页，null 表示已经翻到底。
  const [postCursor, setPostCursor] = useState<string | null | undefined>(undefined);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postError, setPostError] = useState("");
  const [pendingPostStatus, setPendingPostStatus] =
    useState<{ postId: string; status: "HIDDEN" | "DELETED" } | null>(null);
  const communityId = workspace.community.id;
  const firstPageIds = workspace.posts.map((post) => post.id).join(",");

  useEffect(() => {
    setMorePosts([]);
    setPostCursor(undefined);
  }, [communityId, firstPageIds]);

  async function submitComment(postId: string) {
    if (!comment.trim()) return;
    if (await runAction({ action: "ADD_COMMENT", postId, content: comment.trim() })) {
      setComment("");
      setCommentPostId("");
      // 已展开的评论列表需要重新拉取，否则看不到刚发的这条。
      if (expandedComments[postId]) {
        setExpandedComments((current) => {
          const next = { ...current };
          delete next[postId];
          return next;
        });
        await loadComments(postId);
      }
    }
  }

  async function loadComments(postId: string, cursor?: string | null) {
    setLoadingComments(postId);
    setCommentError("");
    const result = await fetchPostComments(communityId, postId, cursor);
    if (result.ok) {
      setExpandedComments((current) => ({
        ...current,
        [postId]: [...(cursor ? current[postId] ?? [] : []), ...result.comments],
      }));
      setCommentCursors((current) => ({ ...current, [postId]: result.nextCursor }));
    } else {
      setCommentError(result.message);
    }
    setLoadingComments("");
  }

  async function runPostAction(input: WorkspaceActionInput) {
    const ok = await runAction(input);
    if (ok) setMenuPostId("");
    return ok;
  }

  async function submitReport() {
    if (!reportPostId || !reportReason) return;
    if (await runPostAction({ action: "REPORT_POST", postId: reportPostId, reason: reportReason })) {
      setReportPostId("");
      setReportReason("不当内容");
    }
  }

  // 工作台刷新后第一页可能与已加载的后续页重叠（比如删掉一条后条目上移），
  // 合并时按 id 去重，避免同一条动态出现两次。
  const visiblePosts = [
    ...new Map(
      [...workspace.posts, ...morePosts].map((post) => [post.id, post]),
    ).values(),
  ].sort(
    (left, right) =>
      Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt))
      || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  async function loadMorePosts() {
    const cursor = postCursor === undefined ? workspace.postsNextCursor : postCursor;
    if (!cursor || loadingPosts) return;
    setLoadingPosts(true);
    setPostError("");
    const result = await fetchCommunityPosts(communityId, cursor);
    if (result.ok) {
      setMorePosts((current) => [...current, ...result.posts]);
      setPostCursor(result.nextCursor);
    } else {
      setPostError(result.message);
    }
    setLoadingPosts(false);
  }

  return (
    <div className="screen-scroll community-panel-stack community-ai-feed">
      {workspace.access.canPublish && (
        <PanelCreateButton label="发布内容" onClick={() => setComposerOpen(true)} />
      )}
      {composerOpen && (
        <PostComposer
          workspace={workspace}
          busy={busy}
          runAction={runAction}
          onClose={() => setComposerOpen(false)}
        />
      )}
      {visiblePosts.length === 0 && (
        <div className="community-ai-feed-empty">
          <span><Icon name="sparkle" size={20} /></span>
          <b>{workspace.community.isOfficial ? "还没有公共内容" : "还没有群动态"}</b>
          <p>{workspace.community.isOfficial
            ? "公共内容由平台管理员整理发布；你可以使用助手查找社群或参加公共活动。"
            : workspace.access.canPublish
              ? "点上方「发布内容」直接发，或在“助手”里用一句话让 AI 帮你整理。"
              : "群内还没有分享，稍后再来看看。"}</p>
        </div>
      )}
      {visiblePosts.map((post) => {
        const isLongArticle = post.postType === "ARTICLE" && Array.from(post.content).length > 160;
        const mediaLabel = post.mediaType === "VIDEO" ? "视频" : post.mediaType === "AUDIO" ? "音频" : "图片";
        return (
        <article key={post.id} className={`card community-post-card${post.postType === "NOTICE" ? " is-notice" : ""}${post.postType === "PRAYER" ? " is-prayer" : ""}${post.pinnedAt ? " is-pinned" : ""}`}>
          <div className="community-post-meta">
            <div className="community-person-row">
              {post.author.avatarUrl ? <img src={resolveAvatarUrl(post.author.avatarUrl) ?? ""} alt="" /> : <span style={{ background: post.author.avatarColor }}>{Array.from(post.author.name)[0] ?? "友"}</span>}
              <div><b>{post.author.name}</b><small>{readableTime(post.createdAt)}</small></div>
            </div>
            <div className="community-post-meta-tools">
              {post.pinnedAt && <span className="community-pinned-label"><Icon name="pin" size={12} />置顶</span>}
              <span className={`community-post-kind is-${post.postType.toLowerCase()}`}>
                {post.postType === "NOTICE" ? "通知" : post.postType === "ARTICLE" ? "文章" : post.postType === "MEDIA" ? mediaLabel : post.postType === "PRAYER" ? "代祷" : "动态"}
              </span>
              {post.visibility === "ADMINS" && <span className="community-post-visibility">仅管理员</span>}
              <button data-icon-button="default" type="button" aria-label={`更多操作：${post.title || "动态"}`} onClick={() => setMenuPostId(menuPostId === post.id ? "" : post.id)}><Icon name="more-horizontal" size={16} /></button>
            </div>
          </div>
          {menuPostId === post.id && (
            <div className="community-post-menu">
              <button type="button" onClick={() => { setReportPostId(post.id); setMenuPostId(""); }}><Icon name="flag" size={14} />举报</button>
              {workspace.access.isAdmin && <button type="button" disabled={busy} onClick={() => runPostAction({ action: "TOGGLE_PIN_POST", postId: post.id })}><Icon name="pin" size={14} />{post.pinnedAt ? "取消置顶" : "置顶"}</button>}
              {workspace.access.isAdmin && <button type="button" disabled={busy} onClick={() => { setMenuPostId(""); setPendingPostStatus({ postId: post.id, status: "HIDDEN" }); }}>隐藏</button>}
              {workspace.access.isAdmin && <button type="button" className="is-danger" disabled={busy} onClick={() => { setMenuPostId(""); setPendingPostStatus({ postId: post.id, status: "DELETED" }); }}>删除</button>}
            </div>
          )}
          {post.title && <h3 className="community-post-title">{post.title}</h3>}
          <p>{isLongArticle ? `${Array.from(post.content).slice(0, 160).join("")}…` : post.content}</p>
          {isLongArticle && <details className="community-article-expand"><summary>阅读全文</summary><p>{post.content}</p></details>}
          {post.mediaUrl && post.mediaType === "IMAGE" && <img className="community-post-media" src={post.mediaUrl} alt={post.title || "群动态图片"} loading="lazy" />}
          {post.mediaUrl && post.mediaType === "AUDIO" && <audio className="community-post-media" controls preload="metadata" src={post.mediaUrl}>当前浏览器不支持音频播放。</audio>}
          {post.mediaUrl && post.mediaType === "VIDEO" && <video className="community-post-media" controls preload="metadata" playsInline src={post.mediaUrl}>当前浏览器不支持视频播放。</video>}
          {post.verseRef && <div className="community-verse-ref"><Icon name="book" size={14} />{post.verseRef}</div>}
          <div className="community-inline-actions">
            {post.postType === "PRAYER"
              ? <>
                  <button disabled={busy} aria-label={`${post.likedByMe ? "取消代祷" : "我为你祷告"}，已有 ${post.likeCount} 人祷告`} aria-pressed={post.likedByMe} className={`community-pray-btn${post.likedByMe ? " is-active" : ""}`} onClick={() => runAction({ action: "TOGGLE_LIKE", postId: post.id })}>🙏 {post.likedByMe ? "已为你祷告" : "我为你祷告"}{post.likeCount > 0 ? ` · ${post.likeCount}` : ""}</button>
                  <button
                    type="button"
                    className="community-prayer-save"
                    aria-label="把这条代祷请求记入我的祷告清单"
                    onClick={(event) => {
                      addPrayer(
                        Array.from(post.content).slice(0, 120).join(""),
                        "community",
                        `${post.author.name}的代祷请求`,
                      );
                      const target = event.currentTarget;
                      target.textContent = "已记入清单";
                      target.disabled = true;
                    }}
                  >
                    记入清单
                  </button>
                </>
              : <button disabled={busy} aria-label={`${post.likedByMe ? "取消点赞" : "点赞"}，当前 ${post.likeCount} 个赞`} aria-pressed={post.likedByMe} className={post.likedByMe ? "is-active" : ""} onClick={() => runAction({ action: "TOGGLE_LIKE", postId: post.id })}><Icon name="heart" size={16} />{post.likeCount}</button>}
            <button aria-label={`写评论，当前 ${post.commentCount} 条`} aria-expanded={commentPostId === post.id} onClick={() => setCommentPostId(commentPostId === post.id ? "" : post.id)}><Icon name="message-square" size={16} />{post.commentCount}</button>
            <button disabled={busy} aria-pressed={post.bookmarkedByMe} className={post.bookmarkedByMe ? "is-bookmarked" : ""} onClick={() => runAction({ action: "TOGGLE_BOOKMARK", postId: post.id })}><Icon name="bookmark" size={16} />{post.bookmarkedByMe ? "已收藏" : "收藏"}</button>
          </div>
          {(() => {
            const expanded = expandedComments[post.id];
            const shown = expanded ?? post.comments;
            const hasMore = expanded
              ? Boolean(commentCursors[post.id])
              : post.commentCount > post.comments.length;
            if (shown.length === 0) return null;
            return (
              <div className="community-comments">
                {shown.map((item) => <div key={item.id}><b>{item.author.name}</b> {item.content}</div>)}
                {hasMore && (
                  <button
                    type="button"
                    className="community-comments-more"
                    disabled={loadingComments === post.id}
                    onClick={() => void loadComments(post.id, expanded ? commentCursors[post.id] : null)}
                  >
                    {loadingComments === post.id
                      ? "加载中…"
                      : expanded
                        ? "加载更多评论"
                        : `查看全部 ${post.commentCount} 条评论`}
                  </button>
                )}
                {commentError && <div className="community-comments-error" role="alert">{commentError}</div>}
              </div>
            );
          })()}
          {commentPostId === post.id && (
            <div className="community-comment-composer">
              <input autoFocus value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="回复这条分享…" />
              <button className="compact-action-btn is-primary" disabled={busy || !comment.trim()} onClick={() => submitComment(post.id)}>发送</button>
            </div>
          )}
        </article>
        );
      })}

      {(postCursor === undefined ? workspace.postsNextCursor : postCursor) && (
        <button
          type="button"
          className="community-feed-more"
          disabled={loadingPosts}
          onClick={() => void loadMorePosts()}
        >
          {loadingPosts ? "加载中…" : "加载更多动态"}
        </button>
      )}
      {postError && <div className="community-feed-more-error" role="alert">{postError}</div>}

      {pendingPostStatus && (
        <ConfirmSheet
          title={pendingPostStatus.status === "HIDDEN" ? "隐藏这条内容？" : "删除这条内容？"}
          description={
            pendingPostStatus.status === "HIDDEN"
              ? "隐藏后群成员将看不到这条内容，管理员仍可恢复。"
              : "删除后成员将无法看到，操作会保留审核记录。"
          }
          confirmLabel={pendingPostStatus.status === "HIDDEN" ? "隐藏" : "删除"}
          busy={busy}
          onCancel={() => setPendingPostStatus(null)}
          onConfirm={() => {
            const pending = pendingPostStatus;
            setPendingPostStatus(null);
            void runPostAction({ action: "UPDATE_POST_STATUS", postId: pending.postId, status: pending.status });
          }}
        />
      )}

      {reportPostId && (
        <div className="community-publish-backdrop" onClick={() => setReportPostId("")}>
          <div className="community-action-sheet" role="dialog" aria-modal="true" aria-label="举报群内容" onClick={(event) => event.stopPropagation()}>
            <div className="community-publish-sheet-header">
              <div><b>举报内容</b><span>请选择最符合的原因，平台管理员会复核处理</span></div>
              <button data-icon-button="default" type="button" aria-label="关闭举报" onClick={() => setReportPostId("")}><Icon name="x" size={20} /></button>
            </div>
            <div className="community-report-reasons" role="group" aria-label="举报原因">
              {["不当内容", "垃圾广告", "人身攻击", "虚假信息", "其他"].map((reason) => (
                <button type="button" key={reason} className={reportReason === reason ? "is-active" : ""} onClick={() => setReportReason(reason)}>{reason}</button>
              ))}
            </div>
            <button type="button" className="compact-action-btn is-primary community-report-submit" disabled={busy} onClick={submitReport}>{busy ? "提交中…" : "提交举报"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function eventStatus(event: WorkspaceEvent) {
  return event.state === "ENDED" ? "已结束" : event.state === "ACTIVE" ? "进行中" : "报名中";
}

export function CommunityEventsPanel({ workspace, busy, runAction }: PanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  // 已结束的活动不该压在报名中的活动上面，分两段展示并默认收起历史。
  const upcoming = workspace.events.filter((event) => event.state !== "ENDED");
  const ended = workspace.events.filter((event) => event.state === "ENDED");

  const eventCard = (event: WorkspaceEvent) => {
    const full = event.capacity !== null && event.signupCount >= event.capacity && !event.signedUpByMe;
    return (
      <article key={event.id} className={`card community-event-card${event.state === "ENDED" ? " is-ended" : ""}`}>
        <div className="community-card-kicker">{eventStatus(event)}</div>
        <h3>{event.title}</h3>
        {event.description && <p>{event.description}</p>}
        <div><Icon name="calendar" size={14} />{readableTime(event.startAt)}{event.endAt ? ` – ${readableTime(event.endAt)}` : ""}</div>
        {event.location && <div><Icon name="map-pin" size={14} />{event.location}</div>}
        <div className="community-event-footer"><span>已报名 {event.signupCount}{event.capacity === null ? " 人" : `/${event.capacity}`}</span><button className={`pill-action-btn${event.signedUpByMe || event.state === "ENDED" ? "" : " is-primary"}`} disabled={busy || full || event.state === "ENDED"} onClick={() => runAction({ action: "TOGGLE_SIGNUP", eventId: event.id })}>{event.state === "ENDED" ? "已结束" : full ? "名额已满" : event.signedUpByMe ? "取消报名" : "报名"}</button></div>
      </article>
    );
  };

  return (
    <div className="screen-scroll community-panel-stack">
      {workspace.access.isAdmin && (
        <PanelCreateButton label="创建活动" onClick={() => setComposerOpen(true)} />
      )}
      {composerOpen && (
        <EventComposer busy={busy} runAction={runAction} onClose={() => setComposerOpen(false)} />
      )}
      {workspace.events.length === 0 && (
        <div className="empty-state-inline">
          {workspace.community.isOfficial ? "暂时没有公共活动。" : "暂时没有群活动。"}
          {workspace.access.isAdmin ? "点上方「创建活动」新建。" : ""}
        </div>
      )}
      {upcoming.length === 0 && ended.length > 0 && (
        <div className="empty-state-inline">近期没有可报名的活动。</div>
      )}
      {upcoming.map(eventCard)}
      {ended.length > 0 && (
        <details className="community-past-events">
          <summary>已结束的活动<span>{ended.length}</span></summary>
          {ended.map(eventCard)}
        </details>
      )}
    </div>
  );
}

export function CommunityMembersPanel({
  workspace,
  busy,
  runAction,
  joinRequests,
  joinRequestsLoading,
  onReviewJoinRequest,
}: PanelProps & {
  joinRequests: CommunityJoinRequest[];
  joinRequestsLoading: boolean;
  onReviewJoinRequest: (requestId: string, decision: "APPROVE" | "REJECT") => Promise<boolean>;
}) {
  const [keyword, setKeyword] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null);
  const normalized = keyword.trim().toLocaleLowerCase();
  const visibleMembers = normalized
    ? workspace.members.filter((member) =>
        `${member.user.name} ${member.user.email ?? ""}`.toLocaleLowerCase().includes(normalized))
    : workspace.members;

  async function review(requestId: string, decision: "APPROVE" | "REJECT") {
    if (reviewingId) return;
    setReviewingId(requestId);
    await onReviewJoinRequest(requestId, decision);
    setReviewingId("");
  }

  async function submitInvite() {
    if (!inviteEmail.trim()) return;
    if (await runAction({ action: "INVITE_MEMBER", email: inviteEmail.trim() })) {
      setInviteEmail("");
      setInviteOpen(false);
    }
  }

  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line"><span>成员 {workspace.usage.members}{workspace.entitlements.memberLimit === null ? "" : `/${workspace.entitlements.memberLimit}`}</span><span>{workspace.entitlements.label}方案</span></div>

      {/* 待审批申请不再只藏在设置页里。 */}
      {workspace.access.canManageMembers && !joinRequestsLoading && joinRequests.length > 0 && (
        <section className="community-join-requests" aria-label="待处理的加入申请">
          <header><b>加入申请</b><span>{joinRequests.length}</span></header>
          {joinRequests.map((joinRequest) => (
            <div key={joinRequest.id} className="community-join-request-row">
              <div className="community-person-row">
                {joinRequest.user.avatarUrl
                  ? <img src={resolveAvatarUrl(joinRequest.user.avatarUrl) ?? ""} alt="" />
                  : <span style={{ background: joinRequest.user.avatarColor }}>{Array.from(joinRequest.user.name)[0] ?? "友"}</span>}
                <div><b>{joinRequest.user.name}</b><small>{joinRequest.user.email ?? "已注册用户"}</small></div>
              </div>
              {joinRequest.message && <p>{joinRequest.message}</p>}
              <div className="community-join-request-actions">
                <button type="button" className="compact-action-btn" disabled={Boolean(reviewingId)} onClick={() => void review(joinRequest.id, "REJECT")}>
                  {reviewingId === joinRequest.id ? "处理中…" : "拒绝"}
                </button>
                <button type="button" className="compact-action-btn is-primary" disabled={Boolean(reviewingId)} onClick={() => void review(joinRequest.id, "APPROVE")}>
                  {reviewingId === joinRequest.id ? "处理中…" : "批准加入"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {workspace.access.canManageMembers && (
        <PanelCreateButton label="邀请成员" icon="users" onClick={() => setInviteOpen(true)} />
      )}
      {inviteOpen && (
        <CommunitySheet
          title="邀请成员"
          hint="填写对方在平台注册的邮箱"
          busy={busy}
          submitLabel="邀请"
          canSubmit={Boolean(inviteEmail.trim())}
          onClose={() => setInviteOpen(false)}
          onSubmit={() => void submitInvite()}
        >
          <label className="community-sheet-field">
            <span>注册邮箱</span>
            <input
              type="email"
              value={inviteEmail}
              placeholder="name@example.com"
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </label>
        </CommunitySheet>
      )}

      {workspace.members.length > 6 && (
        <label className="community-member-search">
          <Icon name="search" size={16} />
          <input
            value={keyword}
            placeholder="搜索成员姓名或邮箱"
            aria-label="搜索社群成员"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
      )}
      {normalized && visibleMembers.length === 0 && (
        <div className="empty-state-inline">没有匹配的成员。</div>
      )}
      {visibleMembers.map((member) => (
        <article key={member.user.id} className="card community-member-card">
          <div className="community-person-row">
            {member.user.avatarUrl ? <img src={resolveAvatarUrl(member.user.avatarUrl) ?? ""} alt="" /> : <span style={{ background: member.user.avatarColor }}>{Array.from(member.user.name)[0] ?? "友"}</span>}
            <div><b>{member.user.name}</b><small>{roleLabel(member.role)} · {member.user.status === "ACTIVE" ? "正常" : member.user.status === "MUTED" ? "已禁言" : "已封禁"}</small></div>
          </div>
          {workspace.access.canManageMembers && member.role !== "OWNER" && (
            <div className="community-member-actions">
              {workspace.access.canManageRoles && <button className="compact-action-btn" disabled={busy} onClick={() => runAction({ action: "UPDATE_MEMBER_ROLE", userId: member.user.id, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" })}>{member.role === "ADMIN" ? "取消管理员" : "设为管理员"}</button>}
              <button className="compact-action-btn is-danger" disabled={busy} onClick={() => setPendingRemoval({ id: member.user.id, name: member.user.name })}>移除</button>
            </div>
          )}
        </article>
      ))}

      {pendingRemoval && (
        <ConfirmSheet
          title={`将 ${pendingRemoval.name} 移出社群？`}
          description="移除后对方将无法查看群内动态、活动与资料，可以重新邀请或申请加入。"
          confirmLabel="移出社群"
          busy={busy}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            const target = pendingRemoval;
            setPendingRemoval(null);
            void runAction({ action: "REMOVE_MEMBER", userId: target.id });
          }}
        />
      )}
    </div>
  );
}

export function CommunityGroupsPanel({ workspace, busy, runAction }: PanelProps) {
  const navigate = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);
  const groupLimitReached = workspace.entitlements.groupLimit !== null
    && workspace.usage.groups >= workspace.entitlements.groupLimit;
  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line"><span>小组 {workspace.usage.groups}{workspace.entitlements.groupLimit === null ? "" : `/${workspace.entitlements.groupLimit}`}</span></div>
      {workspace.access.canCreateGroups && !groupLimitReached && (
        <PanelCreateButton label="新建小组" onClick={() => setComposerOpen(true)} />
      )}
      {workspace.access.canCreateGroups && groupLimitReached && (
        <div className="empty-state-inline">当前方案最多创建 {workspace.entitlements.groupLimit} 个小组。</div>
      )}
      {composerOpen && (
        <GroupComposer busy={busy} runAction={runAction} onClose={() => setComposerOpen(false)} />
      )}
      {workspace.groups.length === 0 && <div className="empty-state-inline">还没有下属小组。{workspace.access.canCreateGroups && !groupLimitReached ? "点上方「新建小组」创建。" : ""}</div>}
      {workspace.groups.map((group) => <button key={group.id} className="card community-group-row" onClick={() => navigate(`/community/${group.id}`)}><span style={{ background: group.avatarColor }}>{group.abbreviation}</span><div><b>{group.name}</b><small>{group.memberCount} 成员{group.description ? ` · ${group.description}` : ""}</small></div><Icon name="chevron-right" size={16} /></button>)}
    </div>
  );
}

export function CommunityResourcesPanel({
  workspace,
  busy,
  runAction,
  onAskAssistant,
  onUploadFile,
}: PanelProps & {
  onAskAssistant: (resource: WorkspaceResource) => void;
  onUploadFile: (input: {
    file: File;
    title: string;
    description?: string;
    visibility: "MEMBERS" | "ADMINS";
  }) => Promise<boolean>;
}) {
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("ALL");
  const [composerOpen, setComposerOpen] = useState(false);
  const [pendingTakedown, setPendingTakedown] = useState<{ id: string; title: string } | null>(null);
  const visibleResources = workspace.resources.filter((resource) =>
    matchesResourceFilter(resource, resourceFilter),
  );

  return (
    <div className="screen-scroll community-panel-stack community-resources-panel">
      {/* 与「成员」栏目同一条用量行：左侧计数，右侧说明 */}
      <div className="community-usage-line">
        <span>资料 {workspace.usage.resources}{workspace.entitlements.resourceLimit === null ? " 份" : `/${workspace.entitlements.resourceLimit}`}</span>
        <span>仅本群可见 · AI 可检索</span>
      </div>
      {workspace.access.canManageResources && (
        <PanelCreateButton label="添加资料" icon="paperclip" onClick={() => setComposerOpen(true)} />
      )}
      {composerOpen && (
        <ResourceComposer
          busy={busy}
          runAction={runAction}
          onUploadFile={onUploadFile}
          onClose={() => setComposerOpen(false)}
        />
      )}
      {workspace.resources.length > 0 && (
        <div className="community-resource-filters" role="group" aria-label="资料分类">
          {([
            ["ALL", "全部"],
            ["DOCUMENT", "文档"],
            ["MEDIA", "影音"],
            ["LINK", "链接"],
          ] as Array<[ResourceFilter, string]>).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={resourceFilter === value ? "is-active" : ""}
              onClick={() => setResourceFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {workspace.resources.length === 0 && <div className="empty-state-inline">暂时没有共享资料。{workspace.access.canManageResources ? "点上方「添加资料」上传。" : ""}</div>}
      {workspace.resources.length > 0 && visibleResources.length === 0 && <div className="empty-state-inline">这个分类暂时没有资料。</div>}
      <div className="community-resource-list">
        {visibleResources.map((resource) => {
          const status = knowledgeStatus(resource);
          const displayTitle = resourceDisplayTitle(resource);
          return (
            <article key={resource.id} className="card community-resource-card">
              <div className="community-resource-summary">
                {resource.url && resource.type === "IMAGE" ? (
                  <img className="community-resource-thumbnail" src={resolveApiUrl(resource.url)} alt="" loading="lazy" />
                ) : (
                  <span className="community-resource-icon"><Icon name={resourceIconName(resource)} size={20} /></span>
                )}
                <div className="community-resource-copy">
                  <b>{displayTitle}</b>
                  <small>{resourceTypeLabel(resource.type)}{typeof resource.fileSize === "number" ? ` · ${readableFileSize(resource.fileSize)}` : ""} · {resource.visibility === "ADMINS" ? "仅管理员" : "全体成员"} · {resource.uploader.name}</small>
                  <span className={`community-knowledge-status ${status.className}`}>{status.label}</span>
                </div>
              </div>
              {resource.description && <p className="community-resource-description">{resource.description}</p>}
              {resource.indexError && <p className="community-knowledge-error">{resource.indexError}</p>}
              {resource.url && resource.type === "AUDIO" && <audio className="community-resource-audio-preview" controls preload="metadata" src={resolveApiUrl(resource.url)}>当前浏览器不支持音频播放。</audio>}
              {resource.url && resource.type === "VIDEO" && <video className="community-resource-video-preview" controls preload="metadata" playsInline src={resolveApiUrl(resource.url)}>当前浏览器不支持视频播放。</video>}
              {resource.type === "TEXT" && resource.contentText && <details className="community-resource-text"><summary>查看文本内容</summary><p>{resource.contentText}</p></details>}
              <div className="community-resource-actions">
                <button className="compact-action-btn is-primary" onClick={() => onAskAssistant(resource)}><Icon name="sparkle" size={14} />问助手</button>
                {resource.url && <a className="compact-action-btn" href={resolveApiUrl(resource.url)} target="_blank" rel="noreferrer"><Icon name="download" size={14} />{resource.fileName ? "查看" : "打开"}</a>}
                {workspace.access.canManageResources && (
                  <details className="community-resource-admin-actions">
                    <summary aria-label={`管理${displayTitle}`}><Icon name="more-horizontal" size={20} />管理</summary>
                    <div>
                      {resource.knowledgeStatus !== "INDEXED" && <button type="button" disabled={busy} onClick={() => runAction({ action: "REINDEX_RESOURCE", resourceId: resource.id })}>重新索引</button>}
                      <button type="button" className="is-danger" disabled={busy} onClick={() => setPendingTakedown({ id: resource.id, title: displayTitle })}>下架资料</button>
                    </div>
                  </details>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {pendingTakedown && (
        <ConfirmSheet
          title="下架这份资料？"
          description={`「${pendingTakedown.title}」下架后成员不再看到，也不再参与助手检索。`}
          confirmLabel="下架"
          busy={busy}
          onCancel={() => setPendingTakedown(null)}
          onConfirm={() => {
            const target = pendingTakedown;
            setPendingTakedown(null);
            void runAction({ action: "UPDATE_RESOURCE_STATUS", resourceId: target.id, status: "HIDDEN" });
          }}
        />
      )}
    </div>
  );
}
