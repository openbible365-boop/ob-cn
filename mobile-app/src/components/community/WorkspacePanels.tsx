import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { resolveApiUrl } from "../../data/api";
import {
  type CommunityWorkspace,
  type WorkspaceActionInput,
  type WorkspaceEvent,
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

  const visiblePosts = [...workspace.posts].sort(
    (left, right) =>
      Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt))
      || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return (
    <div className="screen-scroll community-panel-stack community-ai-feed">
      {visiblePosts.length === 0 && (
        <div className="community-ai-feed-empty">
          <span><Icon name="sparkle" size={21} /></span>
          <b>{workspace.community.isOfficial ? "还没有公共内容" : "还没有群动态"}</b>
          <p>{workspace.community.isOfficial
            ? "公共内容由平台管理员整理发布；你可以使用助手查找社群或参加公共活动。"
            : "请在“助手”中告诉 AI 想发布的内容；AI 整理并经你确认后，会显示在这里。"}</p>
        </div>
      )}
      {visiblePosts.map((post) => {
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
      })}

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
  return (
    <div className="screen-scroll community-panel-stack">
      {workspace.events.length === 0 && (
        <div className="empty-state-inline">
          {workspace.community.isOfficial ? "暂时没有公共活动。" : "暂时没有群活动。"}
          {workspace.access.isAdmin ? "请返回“助手”创建。" : ""}
        </div>
      )}
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

function readableLastSeen(value: string | null | undefined) {
  if (!value) return "离线";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "离线";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "刚刚在线";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} 分钟前在线`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} 小时前在线`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} 天前在线`;
}

export function CommunityMembersPanel({ workspace, busy, runAction }: PanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteError("");
    setInviteMsg("");
    const ok = await runAction({ action: "INVITE_MEMBER", email: inviteEmail.trim() });
    if (ok) {
      setInviteMsg("邀请成功！已成功将该用户加入社群。");
      setInviteEmail("");
      setTimeout(() => {
        setShowInvite(false);
        setInviteMsg("");
      }, 2000);
    } else {
      setInviteError("邀请失败，请确认邮箱格式或该用户是否已注册且状态正常。");
    }
    setInviteBusy(false);
  };

  const filteredMembers = workspace.members.filter((member) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.user.name.toLowerCase().includes(query) ||
      (member.user.email ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>成员 {workspace.usage.members}{workspace.entitlements.memberLimit === null ? "" : `/${workspace.entitlements.memberLimit}`}</span>
        {workspace.access.isAdmin && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            style={{
              padding: "4px 10px",
              background: "rgba(191,120,246,0.15)",
              color: "var(--purple)",
              border: 0,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <Icon name="plus" size={12} />
            邀请成员
          </button>
        )}
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", background: "var(--surface-2)", borderRadius: 10, padding: "8px 12px", border: "1px solid var(--line)" }}>
          <span style={{ display: "flex", alignItems: "center", color: "var(--body)", marginRight: 8 }}>
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索成员姓名或邮箱..."
            style={{ border: 0, background: "transparent", fontSize: 13, color: "var(--ink)", width: "100%", outline: "none" }}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} style={{ border: 0, background: "transparent", color: "var(--body)", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      {showInvite && (
        <div className="community-publish-backdrop" onClick={() => setShowInvite(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="community-action-sheet" role="dialog" aria-modal="true" aria-label="邀请新成员" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 360, width: "90%", borderRadius: 18, padding: 20 }}>
            <div className="community-publish-sheet-header" style={{ marginBottom: 15 }}>
              <div><b>邀请新成员</b><span>通过已注册邮箱邀请对方加入社群</span></div>
              <button type="button" aria-label="关闭邀请" onClick={() => setShowInvite(false)}><Icon name="x" size={19} /></button>
            </div>
            <form onSubmit={handleInviteSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="请输入对方登录邮箱..."
                style={{ width: "100%", height: 44, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, background: "var(--white)" }}
              />
              {inviteError && <div style={{ fontSize: 11, color: "var(--pink)", fontWeight: 700 }}>{inviteError}</div>}
              {inviteMsg && <div style={{ fontSize: 11, color: "#267A45", fontWeight: 700 }}>{inviteMsg}</div>}
              <button type="submit" className="btn-primary" disabled={inviteBusy} style={{ minHeight: 40, width: "100%", marginTop: 8 }}>
                {inviteBusy ? "邀请中..." : "确认邀请"}
              </button>
            </form>
          </div>
        </div>
      )}

      {filteredMembers.length === 0 && <div className="empty-state-inline">没有找到符合条件的成员。</div>}
      {filteredMembers.map((member) => (
        <article key={member.user.id} className="card community-member-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="community-person-row" style={{ width: "100%" }}>
            {member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" /> : <span style={{ background: member.user.avatarColor }}>{Array.from(member.user.name)[0] ?? "友"}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <b>{member.user.name}</b>
                {member.role === "OWNER" && <span style={{ fontSize: 8, padding: "2px 6px", background: "rgba(225,49,125,.11)", color: "var(--pink)", borderRadius: 6, fontWeight: 800 }}>群主</span>}
                {member.role === "ADMIN" && <span style={{ fontSize: 8, padding: "2px 6px", background: "rgba(191,120,246,.15)", color: "var(--purple)", borderRadius: 6, fontWeight: 800 }}>管理员</span>}
              </div>
              <small>
                {member.user.status === "MUTED" ? "已禁言" : member.user.status === "BANNED" ? "已封禁" : "正常"}
                {` · ${readableLastSeen(member.user.lastSeenAt)}`}
              </small>
            </div>
          </div>
          {workspace.access.canManageMembers && member.role !== "OWNER" && (
            <div className="community-member-actions" style={{ marginTop: 4 }}>
              {workspace.access.canManageRoles && (
                <button className="compact-action-btn" disabled={busy} onClick={() => runAction({ action: "UPDATE_MEMBER_ROLE", userId: member.user.id, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" })}>
                  {member.role === "ADMIN" ? "取消管理员" : "设为管理员"}
                </button>
              )}
              {member.user.status === "MUTED" ? (
                <button className="compact-action-btn" disabled={busy} onClick={() => runAction({ action: "UNMUTE_MEMBER", userId: member.user.id })}>
                  解除禁言
                </button>
              ) : (
                <button className="compact-action-btn" disabled={busy} onClick={() => window.confirm(`确认禁言 ${member.user.name} 7天吗？`) && runAction({ action: "MUTE_MEMBER", userId: member.user.id })}>
                  禁言
                </button>
              )}
              {workspace.access.isOwner && (
                <button className="compact-action-btn" disabled={busy} onClick={() => window.confirm(`确认将群主转让给 ${member.user.name} 吗？您的身份将变更为管理员。`) && runAction({ action: "TRANSFER_OWNER", userId: member.user.id })}>
                  转让群主
                </button>
              )}
              <button className="compact-action-btn is-danger" disabled={busy} onClick={() => window.confirm(`确认将 ${member.user.name} 移出社群？`) && runAction({ action: "REMOVE_MEMBER", userId: member.user.id })}>移除</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function CommunityGroupsPanel({ workspace }: PanelProps) {
  const navigate = useNavigate();
  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line"><span>小组 {workspace.usage.groups}{workspace.entitlements.groupLimit === null ? "" : `/${workspace.entitlements.groupLimit}`}</span></div>
      {workspace.groups.length === 0 && <div className="empty-state-inline">还没有下属小组。{workspace.access.canCreateGroups ? "请返回“助手”新建。" : ""}</div>}
      {workspace.groups.map((group) => <button key={group.id} className="card community-group-row" onClick={() => navigate(`/community/${group.id}`)}><span style={{ background: group.avatarColor }}>{group.abbreviation}</span><div><b>{group.name}</b><small>{group.memberCount} 成员{group.description ? ` · ${group.description}` : ""}</small></div><Icon name="chevron-right" size={17} /></button>)}
    </div>
  );
}

export function CommunityResourcesPanel({
  workspace,
  busy,
  runAction,
  onAskAssistant,
}: PanelProps & {
  onAskAssistant: (resource: WorkspaceResource) => void;
}) {
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleResources = workspace.resources.filter((resource) => {
    const matchesFilter = matchesResourceFilter(resource, resourceFilter);
    if (!matchesFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      resource.title.toLowerCase().includes(query) ||
      (resource.description ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="screen-scroll community-panel-stack">
      <div className="community-usage-line">
        <span>资料 {workspace.usage.resources}{workspace.entitlements.resourceLimit === null ? "" : `/${workspace.entitlements.resourceLimit}`}</span>
      </div>
      
      <div style={{ padding: "0 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", background: "var(--surface-2)", borderRadius: 10, padding: "8px 12px", border: "1px solid var(--line)" }}>
          <span style={{ display: "flex", alignItems: "center", color: "var(--body)", marginRight: 8 }}>
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索资料标题或描述..."
            style={{ border: 0, background: "transparent", fontSize: 13, color: "var(--ink)", width: "100%", outline: "none" }}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} style={{ border: 0, background: "transparent", color: "var(--body)", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="community-knowledge-note">
        <Icon name="sparkle" size={16} />
        <span>资料仅供本群使用；管理员可在“助手”中上传，AI 会检索当前群知识库。</span>
      </div>
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
      {workspace.resources.length === 0 && <div className="empty-state-inline">暂时没有共享资料。{workspace.access.canManageResources ? "请返回“助手”上传。" : ""}</div>}
      {workspace.resources.length > 0 && visibleResources.length === 0 && <div className="empty-state-inline">没有找到符合条件的资料。</div>}
      {visibleResources.map((resource) => (
        <article key={resource.id} className="card community-resource-card">
          {resource.url && resource.type === "IMAGE" && <img className="community-resource-media-preview" src={resolveApiUrl(resource.url)} alt={resource.title} loading="lazy" />}
          {resource.url && resource.type === "AUDIO" && <audio className="community-resource-audio-preview" controls preload="metadata" src={resolveApiUrl(resource.url)}>当前浏览器不支持音频播放。</audio>}
          {resource.url && resource.type === "VIDEO" && <video className="community-resource-media-preview" controls preload="metadata" playsInline src={resolveApiUrl(resource.url)}>当前浏览器不支持视频播放。</video>}
          <div className="community-resource-main">
            <span><Icon name={resourceIconName(resource)} size={18} /></span>
            <div>
              <b>{resource.title}</b>
              <small>
                {resourceTypeLabel(resource.type)}
                {typeof resource.fileSize === "number" ? ` · ${readableFileSize(resource.fileSize)}` : ""}
                {typeof resource.downloadCount === "number" ? ` · 查看/下载 ${resource.downloadCount} 次` : ""}
                {` · ${resource.visibility === "ADMINS" ? "仅管理员" : "全体成员"} · ${resource.uploader.name}`}
              </small>
              {resource.description && <p>{resource.description}</p>}
              {resource.indexedAt && <em><Icon name="sparkle" size={11} />已加入本群知识库</em>}
            </div>
          </div>
          {resource.type === "TEXT" && resource.contentText && <details className="community-resource-text"><summary>查看文本内容</summary><p>{resource.contentText}</p></details>}
          <div className="community-resource-actions">
            <button className="compact-action-btn" onClick={() => onAskAssistant(resource)}><Icon name="sparkle" size={14} />问助手</button>
            <button className={`compact-action-btn${resource.bookmarkedByMe ? " is-bookmarked" : ""}`} disabled={busy} onClick={() => runAction({ action: "TOGGLE_RESOURCE_BOOKMARK", resourceId: resource.id })} style={resource.bookmarkedByMe ? { color: "var(--pink)", fontWeight: 700 } : undefined}>
              <Icon name="bookmark" size={14} />
              {resource.bookmarkedByMe ? "已收藏" : "收藏"}
            </button>
            {resource.url && <a className="compact-action-btn" href={resolveApiUrl(resource.url)} target="_blank" rel="noreferrer"><Icon name="download" size={14} />{resource.fileName ? "查看/下载" : "打开链接"}</a>}
            {workspace.access.canManageResources && <button className="compact-action-btn is-danger" disabled={busy} onClick={() => window.confirm("确认下架这份资料？") && runAction({ action: "UPDATE_RESOURCE_STATUS", resourceId: resource.id, status: "HIDDEN" })}>下架</button>}
          </div>
        </article>
      ))}
    </div>
  );
}
