import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import {
  type CommunityWorkspace,
  type WorkspaceActionInput,
  type WorkspaceEvent,
  type WorkspacePostMediaType,
  type WorkspacePostType,
  type WorkspaceResource,
} from "../../data/community-workspace";

type PanelProps = {
  workspace: CommunityWorkspace;
  busy: boolean;
  runAction: (input: WorkspaceActionInput) => Promise<boolean>;
};

export type CommunityMoreSection = "members" | "groups" | "resources";

export function CommunityMorePanel({
  workspace,
  onOpen,
}: {
  workspace: CommunityWorkspace;
  onOpen: (section: CommunityMoreSection) => void;
}) {
  const items: Array<{
    id: CommunityMoreSection;
    title: string;
    description: string;
    count: string;
    icon: string;
  }> = [
    {
      id: "members",
      title: "成员",
      description: workspace.access.isAdmin ? "成员名单、角色与加入申请" : "成员名单、角色与公开信息",
      count: `${workspace.usage.members} 人`,
      icon: "users",
    },
    {
      id: "groups",
      title: "小组",
      description: workspace.access.canCreateGroups ? "查经班、团契与服事小组" : "查看和进入所属小组",
      count: `${workspace.usage.groups} 个`,
      icon: "users",
    },
    {
      id: "resources",
      title: "资料",
      description: "文档、链接、音频、视频与读经材料",
      count: `${workspace.usage.resources} 份`,
      icon: "book",
    },
  ];

  return (
    <div className="screen-scroll community-more-panel">
      <div className="community-more-intro">
        <b>社群内容与成员</b>
        <span>成员、小组和资料集中在这里</span>
      </div>
      {items.map((item) => (
        <button key={item.id} className="card community-more-row" onClick={() => onOpen(item.id)}>
          <span className="community-more-icon"><Icon name={item.icon} size={20} /></span>
          <span>
            <b>{item.title}</b>
            <small>{item.description}</small>
          </span>
          <em>{item.count}</em>
          <Icon name="chevron-right" size={17} />
        </button>
      ))}
      {workspace.access.isAdmin && (
        <div className="community-more-admin-note"><Icon name="settings" size={15} />管理操作请使用右上角设置入口</div>
      )}
    </div>
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
  return { LINK: "链接", DOCUMENT: "文档", AUDIO: "音频", VIDEO: "视频", IMAGE: "图片" }[type];
}

export function CommunitySharePanel({ workspace, busy, runAction }: PanelProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [postType, setPostType] = useState<WorkspacePostType>("POST");
  const [feedFilter, setFeedFilter] = useState<"ALL" | "EVENT" | WorkspacePostType>("ALL");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [verseRef, setVerseRef] = useState("");
  const [mediaType, setMediaType] = useState<WorkspacePostMediaType>("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [commentPostId, setCommentPostId] = useState("");
  const [comment, setComment] = useState("");
  const [menuPostId, setMenuPostId] = useState("");
  const [reportPostId, setReportPostId] = useState("");
  const [reportReason, setReportReason] = useState("不当内容");

  const isLongForm = postType === "ARTICLE";
  const requiresTitle = postType === "ARTICLE" || postType === "NOTICE";
  const requiresMedia = postType === "MEDIA";
  const canPublish = Boolean(
    content.trim()
    && (!requiresTitle || title.trim())
    && (!requiresMedia || mediaUrl.trim()),
  );

  function selectPublishType(nextType: WorkspacePostType, nextMediaType: WorkspacePostMediaType = "IMAGE") {
    setPostType(nextType);
    setMediaType(nextMediaType);
    if (nextType === "NOTICE") {
      setMediaUrl("");
    }
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!canPublish) return;
    const ok = await runAction({
      action: "CREATE_POST",
      postType,
      title: title.trim() || undefined,
      content: content.trim(),
      verseRef: postType === "NOTICE" ? undefined : verseRef.trim() || undefined,
      mediaType: mediaUrl.trim() ? mediaType : undefined,
      mediaUrl: mediaUrl.trim() || undefined,
    });
    if (ok) {
      setTitle("");
      setContent("");
      setVerseRef("");
      setMediaUrl("");
      setMediaType("IMAGE");
      setPostType("POST");
      setShowComposer(false);
    }
  }

  async function submitComment(postId: string) {
    if (!comment.trim()) return;
    if (await runAction({ action: "ADD_COMMENT", postId, content: comment.trim() })) {
      setComment("");
      setCommentPostId("");
    }
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

  const typeOptions: Array<{
    id: string;
    label: string;
    helper: string;
    icon: string;
    postType: WorkspacePostType;
    mediaType?: WorkspacePostMediaType;
  }> = [
    { id: "post", label: "动态", helper: "类似微博", icon: "edit", postType: "POST" },
    { id: "article", label: "文章", helper: "长文分享", icon: "book", postType: "ARTICLE" },
    { id: "video", label: "视频", helper: "视频链接", icon: "play", postType: "MEDIA", mediaType: "VIDEO" },
    { id: "audio", label: "音频", helper: "讲道与诗歌", icon: "volume-2", postType: "MEDIA", mediaType: "AUDIO" },
    ...(workspace.access.isAdmin ? [{ id: "notice", label: "通知", helper: "管理员发布", icon: "bell", postType: "NOTICE" as const }] : []),
  ];
  const feedFilters: Array<{ id: "ALL" | "EVENT" | WorkspacePostType; label: string }> = [
    { id: "ALL", label: "全部" },
    { id: "POST", label: "动态" },
    { id: "ARTICLE", label: "文章" },
    { id: "MEDIA", label: "影音" },
    { id: "EVENT", label: "活动" },
    { id: "NOTICE", label: "通知" },
  ];
  const visibleContent = [
    ...workspace.posts
      .filter((post) => feedFilter === "ALL" || post.postType === feedFilter)
      .map((post) => ({ kind: "post" as const, id: post.id, createdAt: post.createdAt, priority: post.pinnedAt ? 1 : 0, post })),
    ...workspace.events
      .filter(() => feedFilter === "ALL" || feedFilter === "EVENT")
      .map((event) => ({ kind: "event" as const, id: event.id, createdAt: event.createdAt, priority: 0, event })),
  ].sort((left, right) => right.priority - left.priority || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-feed-topline">
        <div>
          <b>群动态</b>
          <span>文章、影音、活动和通知都在这里</span>
        </div>
        <button className="community-publish-trigger" type="button" onClick={() => setShowComposer(true)}><Icon name="edit" size={15} />发布</button>
      </div>

      <div className="community-feed-filters" role="group" aria-label="筛选群动态">
        {feedFilters.map((item) => (
          <button type="button" key={item.id} className={feedFilter === item.id ? "is-active" : ""} onClick={() => setFeedFilter(item.id)}>{item.label}</button>
        ))}
      </div>

      {visibleContent.length === 0 && <div className="empty-state-inline">{workspace.posts.length === 0 && workspace.events.length === 0 ? "还没有群内容，发布第一条动态吧。" : "这个分类暂时没有内容。"}</div>}
      {visibleContent.map((item) => item.kind === "event" ? (
        <article key={`event-${item.id}`} className="card community-post-card community-feed-event-card">
          <div className="community-post-meta">
            <div className="community-feed-event-icon"><Icon name="calendar" size={18} /></div>
            <span className="community-post-kind is-event">活动 · {eventStatus(item.event)}</span>
          </div>
          <h3 className="community-post-title">{item.event.title}</h3>
          {item.event.description && <p>{item.event.description}</p>}
          <div className="community-feed-event-detail"><Icon name="calendar" size={14} />{readableTime(item.event.startAt)}{item.event.endAt ? ` – ${readableTime(item.event.endAt)}` : ""}</div>
          {item.event.location && <div className="community-feed-event-detail"><Icon name="map-pin" size={14} />{item.event.location}</div>}
          <div className="community-event-footer">
            <span>已报名 {item.event.signupCount}{item.event.capacity === null ? " 人" : `/${item.event.capacity}`}</span>
            <button
              className={`pill-action-btn${item.event.signedUpByMe ? "" : " is-primary"}`}
              disabled={busy || item.event.state === "ENDED" || (item.event.capacity !== null && item.event.signupCount >= item.event.capacity && !item.event.signedUpByMe)}
              onClick={() => runAction({ action: "TOGGLE_SIGNUP", eventId: item.event.id })}
            >
              {item.event.state === "ENDED" ? "已结束" : item.event.signedUpByMe ? "取消报名" : "报名"}
            </button>
          </div>
        </article>
      ) : (() => {
        const post = item.post;
        const isLongArticle = post.postType === "ARTICLE" && Array.from(post.content).length > 160;
        const mediaLabel = post.mediaType === "VIDEO" ? "视频" : post.mediaType === "AUDIO" ? "音频" : "图片";
        return (
        <article key={post.id} className={`card community-post-card${post.postType === "NOTICE" ? " is-notice" : ""}${post.pinnedAt ? " is-pinned" : ""}`}>
          <div className="community-post-meta">
            <div className="community-person-row">
              {post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" /> : <span style={{ background: post.author.avatarColor }}>{Array.from(post.author.name)[0] ?? "友"}</span>}
              <div><b>{post.author.name}</b><small>{readableTime(post.createdAt)}</small></div>
            </div>
            <div className="community-post-meta-tools">
              {post.pinnedAt && <span className="community-pinned-label"><Icon name="pin" size={11} />置顶</span>}
              <span className={`community-post-kind is-${post.postType.toLowerCase()}`}>
                {post.postType === "NOTICE" ? "通知" : post.postType === "ARTICLE" ? "文章" : post.postType === "MEDIA" ? mediaLabel : "动态"}
              </span>
              <button type="button" aria-label={`更多操作：${post.title || "动态"}`} onClick={() => setMenuPostId(menuPostId === post.id ? "" : post.id)}><Icon name="more-horizontal" size={17} /></button>
            </div>
          </div>
          {menuPostId === post.id && (
            <div className="community-post-menu">
              <button type="button" onClick={() => { setReportPostId(post.id); setMenuPostId(""); }}><Icon name="flag" size={14} />举报</button>
              {workspace.access.isAdmin && <button type="button" disabled={busy} onClick={() => runPostAction({ action: "TOGGLE_PIN_POST", postId: post.id })}><Icon name="pin" size={14} />{post.pinnedAt ? "取消置顶" : "置顶"}</button>}
              {workspace.access.isAdmin && <button type="button" disabled={busy} onClick={() => window.confirm("确认隐藏这条内容？隐藏后成员将无法看到。") && runPostAction({ action: "UPDATE_POST_STATUS", postId: post.id, status: "HIDDEN" })}>隐藏</button>}
              {workspace.access.isAdmin && <button type="button" className="is-danger" disabled={busy} onClick={() => window.confirm("确认删除这条内容？此操作会保留审核记录。") && runPostAction({ action: "UPDATE_POST_STATUS", postId: post.id, status: "DELETED" })}>删除</button>}
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
            <button disabled={busy} className={post.likedByMe ? "is-active" : ""} onClick={() => runAction({ action: "TOGGLE_LIKE", postId: post.id })}><Icon name="heart" size={15} />{post.likeCount}</button>
            <button onClick={() => setCommentPostId(commentPostId === post.id ? "" : post.id)}><Icon name="message-square" size={15} />{post.commentCount}</button>
            <button disabled={busy} className={post.bookmarkedByMe ? "is-bookmarked" : ""} onClick={() => runAction({ action: "TOGGLE_BOOKMARK", postId: post.id })}><Icon name="bookmark" size={15} />{post.bookmarkedByMe ? "已收藏" : "收藏"}</button>
          </div>
          {post.comments.length > 0 && (
            <div className="community-comments">
              {post.comments.map((item) => <div key={item.id}><b>{item.author.name}</b> {item.content}</div>)}
            </div>
          )}
          {commentPostId === post.id && (
            <div className="community-comment-composer">
              <input autoFocus value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="回复这条分享…" />
              <button className="compact-action-btn is-primary" disabled={busy || !comment.trim()} onClick={() => submitComment(post.id)}>发送</button>
            </div>
          )}
        </article>
        );
      })())}

      {showComposer && (
        <div className="community-publish-backdrop" onClick={() => setShowComposer(false)}>
          <form className="community-publish-sheet" role="dialog" aria-modal="true" aria-label="发布群内容" onSubmit={publish} onClick={(event) => event.stopPropagation()}>
            <div className="community-publish-sheet-header">
              <div><b>发布</b><span>{postType === "NOTICE" ? "通知仅群主和管理员可见此入口" : "选择要发布的内容类型"}</span></div>
              <button type="button" aria-label="关闭发布" onClick={() => setShowComposer(false)}><Icon name="x" size={19} /></button>
            </div>
            <div className="community-publish-types" role="group" aria-label="发布类型">
              {typeOptions.map((item) => {
                const selected = postType === item.postType && (item.postType !== "MEDIA" || mediaType === item.mediaType);
                return (
                  <button type="button" key={item.id} className={selected ? "is-active" : ""} onClick={() => selectPublishType(item.postType, item.mediaType)}>
                    <span><Icon name={item.icon} size={17} /></span>
                    <b>{item.label}</b>
                    <small>{item.helper}</small>
                  </button>
                );
              })}
            </div>
            {requiresTitle && (
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={postType === "NOTICE" ? "通知标题" : "文章标题"} aria-label={postType === "NOTICE" ? "通知标题" : "文章标题"} required />
            )}
            <textarea
              id="community-post"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={isLongForm ? 10000 : 2000}
              placeholder={postType === "ARTICLE" ? "写下完整文章内容…" : postType === "NOTICE" ? "填写需要群成员知晓的事项…" : postType === "MEDIA" ? `介绍这段${mediaType === "VIDEO" ? "视频" : "音频"}内容…` : "分享此刻想法、经文亮光或生活见证…"}
              rows={isLongForm ? 7 : 4}
              aria-label="发布内容"
            />
            {postType === "MEDIA" && (
              <input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder={`粘贴${mediaType === "VIDEO" ? "视频" : "音频"}链接`} aria-label="媒体链接" required />
            )}
            {(postType === "POST" || postType === "ARTICLE") && (
              <input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="图片链接（选填）" aria-label="图片链接" />
            )}
            <div className="community-compose-row">
              {postType !== "NOTICE" && <input value={verseRef} onChange={(event) => setVerseRef(event.target.value)} maxLength={100} placeholder="经文引用（选填）" aria-label="经文引用" />}
              <button className="compact-action-btn is-primary" disabled={busy || !canPublish}>{busy ? "提交中…" : postType === "NOTICE" ? "发布通知" : "发布"}</button>
            </div>
          </form>
        </div>
      )}

      {reportPostId && (
        <div className="community-publish-backdrop" onClick={() => setReportPostId("")}>
          <div className="community-action-sheet" role="dialog" aria-modal="true" aria-label="举报群内容" onClick={(event) => event.stopPropagation()}>
            <div className="community-publish-sheet-header">
              <div><b>举报内容</b><span>请选择最符合的原因，平台管理员会复核处理</span></div>
              <button type="button" aria-label="关闭举报" onClick={() => setReportPostId("")}><Icon name="x" size={19} /></button>
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
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [capacity, setCapacity] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !startAt) return;
    const ok = await runAction({
      action: "CREATE_EVENT",
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      capacity: capacity ? Number(capacity) : undefined,
    });
    if (ok) {
      setTitle(""); setDescription(""); setLocation(""); setStartAt(""); setEndAt(""); setCapacity(""); setShowCreate(false);
    }
  }

  return (
    <div className="screen-scroll community-panel-stack">
      {workspace.access.isAdmin && (
        <button className="community-section-action" onClick={() => setShowCreate((value) => !value)}><Icon name={showCreate ? "x" : "calendar"} size={16} />{showCreate ? "取消创建" : "创建活动"}</button>
      )}
      {showCreate && (
        <form className="card community-form-grid" onSubmit={create}>
          <label>活动标题<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required /></label>
          <label>活动说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
          <label>地点或会议方式<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <div className="community-form-columns"><label>开始时间<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /></label><label>结束时间<input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /></label></div>
          <label>报名名额（留空表示不限）<input type="number" min={1} max={100000} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
          <button className="compact-action-btn is-primary" disabled={busy}>保存活动</button>
        </form>
      )}
      {workspace.events.length === 0 && <div className="empty-state-inline">暂时没有活动。</div>}
      {workspace.events.map((event) => {
        const full = event.capacity !== null && event.signupCount >= event.capacity && !event.signedUpByMe;
        return (
          <article key={event.id} className="card community-event-card">
            <div className="community-card-kicker">{eventStatus(event)}</div>
            <h3>{event.title}</h3>
            {event.description && <p>{event.description}</p>}
            <div><Icon name="calendar" size={14} />{readableTime(event.startAt)}{event.endAt ? ` – ${readableTime(event.endAt)}` : ""}</div>
            {event.location && <div><Icon name="map-pin" size={14} />{event.location}</div>}
            <div className="community-event-footer"><span>已报名 {event.signupCount}{event.capacity === null ? " 人" : `/${event.capacity}`}</span><button className={`pill-action-btn${event.signedUpByMe ? "" : " is-primary"}`} disabled={busy || full || event.state === "ENDED"} onClick={() => runAction({ action: "TOGGLE_SIGNUP", eventId: event.id })}>{event.state === "ENDED" ? "已结束" : full ? "名额已满" : event.signedUpByMe ? "取消报名" : "报名"}</button></div>
          </article>
        );
      })}
    </div>
  );
}

export function CommunityMembersPanel({ workspace, busy, runAction }: PanelProps) {
  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line"><span>成员 {workspace.usage.members}{workspace.entitlements.memberLimit === null ? "" : `/${workspace.entitlements.memberLimit}`}</span><span>{workspace.entitlements.label}方案</span></div>
      {workspace.members.map((member) => (
        <article key={member.user.id} className="card community-member-card">
          <div className="community-person-row">
            {member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" /> : <span style={{ background: member.user.avatarColor }}>{Array.from(member.user.name)[0] ?? "友"}</span>}
            <div><b>{member.user.name}</b><small>{roleLabel(member.role)} · {member.user.status === "ACTIVE" ? "正常" : member.user.status === "MUTED" ? "已禁言" : "已封禁"}</small></div>
          </div>
          {workspace.access.canManageMembers && member.role !== "OWNER" && (
            <div className="community-member-actions">
              {workspace.access.canManageRoles && <button className="compact-action-btn" disabled={busy} onClick={() => runAction({ action: "UPDATE_MEMBER_ROLE", userId: member.user.id, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" })}>{member.role === "ADMIN" ? "取消管理员" : "设为管理员"}</button>}
              <button className="compact-action-btn is-danger" disabled={busy} onClick={() => window.confirm(`确认将 ${member.user.name} 移出社群？`) && runAction({ action: "REMOVE_MEMBER", userId: member.user.id })}>移除</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function CommunityGroupsPanel({ workspace, busy, runAction }: PanelProps) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [description, setDescription] = useState("");
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await runAction({ action: "CREATE_GROUP", name: name.trim(), abbreviation: abbreviation.trim(), description: description.trim() || undefined })) {
      setName(""); setAbbreviation(""); setDescription(""); setShowCreate(false);
    }
  }
  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line"><span>小组 {workspace.usage.groups}{workspace.entitlements.groupLimit === null ? "" : `/${workspace.entitlements.groupLimit}`}</span>{workspace.access.canCreateGroups && <button onClick={() => setShowCreate((value) => !value)}>{showCreate ? "取消" : "新建小组"}</button>}</div>
      {showCreate && <form className="card community-form-grid" onSubmit={create}><label>小组名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} required /></label><label>简称（1–2 字）<input value={abbreviation} onChange={(event) => setAbbreviation(event.target.value)} maxLength={2} required /></label><label>简介<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label><button className="compact-action-btn is-primary" disabled={busy}>创建小组</button></form>}
      {workspace.groups.length === 0 && <div className="empty-state-inline">还没有下属小组。</div>}
      {workspace.groups.map((group) => <button key={group.id} className="card community-group-row" onClick={() => navigate(`/community/${group.id}`)}><span style={{ background: group.avatarColor }}>{group.abbreviation}</span><div><b>{group.name}</b><small>{group.memberCount} 成员{group.description ? ` · ${group.description}` : ""}</small></div><Icon name="chevron-right" size={17} /></button>)}
    </div>
  );
}

export function CommunityResourcesPanel({ workspace, busy, runAction }: PanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<WorkspaceResource["type"]>("LINK");
  const [visibility, setVisibility] = useState<WorkspaceResource["visibility"]>("MEMBERS");
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await runAction({ action: "CREATE_RESOURCE", title: title.trim(), url: url.trim(), description: description.trim() || undefined, type, visibility })) {
      setTitle(""); setUrl(""); setDescription(""); setType("LINK"); setVisibility("MEMBERS"); setShowCreate(false);
    }
  }
  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line"><span>资料 {workspace.usage.resources}{workspace.entitlements.resourceLimit === null ? "" : `/${workspace.entitlements.resourceLimit}`}</span>{workspace.access.canManageResources && <button onClick={() => setShowCreate((value) => !value)}>{showCreate ? "取消" : "添加资料"}</button>}</div>
      {showCreate && <form className="card community-form-grid" onSubmit={create}><label>资料标题<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label><label>资料链接<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" required /></label><label>说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label><div className="community-form-columns"><label>类型<select value={type} onChange={(event) => setType(event.target.value as WorkspaceResource["type"])}><option value="LINK">链接</option><option value="DOCUMENT">文档</option><option value="AUDIO">音频</option><option value="VIDEO">视频</option><option value="IMAGE">图片</option></select></label><label>可见范围<select value={visibility} onChange={(event) => setVisibility(event.target.value as WorkspaceResource["visibility"])}><option value="MEMBERS">全体成员</option><option value="ADMINS">仅管理员</option></select></label></div><button className="compact-action-btn is-primary" disabled={busy}>保存资料</button></form>}
      {workspace.resources.length === 0 && <div className="empty-state-inline">暂时没有共享资料。</div>}
      {workspace.resources.map((resource) => <article key={resource.id} className="card community-resource-card"><a href={resource.url} target="_blank" rel="noreferrer"><span><Icon name={resource.type === "AUDIO" ? "volume-2" : resource.type === "VIDEO" ? "play" : resource.type === "IMAGE" ? "image" : "book"} size={18} /></span><div><b>{resource.title}</b><small>{resourceTypeLabel(resource.type)} · {resource.visibility === "ADMINS" ? "仅管理员" : "全体成员"} · {resource.uploader.name}</small>{resource.description && <p>{resource.description}</p>}</div><Icon name="chevron-right" size={17} /></a>{workspace.access.canManageResources && <button className="compact-action-btn is-danger" disabled={busy} onClick={() => window.confirm("确认下架这份资料？") && runAction({ action: "UPDATE_RESOURCE_STATUS", resourceId: resource.id, status: "HIDDEN" })}>下架</button>}</article>)}
    </div>
  );
}
