import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import {
  fetchCommunityJoinRequests,
  getGroup,
  reviewCommunityJoinRequest,
  updateGroup,
  type CommunityJoinRequest,
} from "../data/community";
import { performWorkspaceAction } from "../data/community-workspace";

const TIERS = [
  { id: "初阶", members: "50 成员", ai: "基础 AI 额度", price: "免费" },
  { id: "中阶", members: "200 成员", ai: "进阶 AI 额度 + 知识库", price: "¥30/月" },
  { id: "高阶", members: "1000 成员", ai: "高额 AI 额度 + 专属人设", price: "¥98/月" },
];

function requestTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// 社群设置（仅群主或管理员可见）
export function GroupSettingsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const group = getGroup(groupId ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(
    (group?.desc ?? "").replace(/^\d+ 成员(?: · )?/, ""),
  );
  const [tier, setTier] = useState(group?.tier ?? "初阶");
  const [saved, setSaved] = useState(false);
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    let active = true;
    setRequestsLoading(true);
    setRequestsError("");
    fetchCommunityJoinRequests(groupId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setJoinRequests(result.requests);
      } else {
        setRequestsError(result.message);
      }
      setRequestsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!saved || !group) return;
    const timer = window.setTimeout(() => navigate(`/community/${group.id}`), 600);
    return () => window.clearTimeout(timer);
  }, [saved, group, navigate]);

  if (!group) {
    return (
      <div className="screen">
        <UnifiedHeader title="社群设置" subtitle="不存在" ariaLabel="社群设置状态" onBack={() => navigate("/community")} backLabel="返回社群" />
        <div style={{ padding: 24, fontSize: 13, color: "var(--body)" }}>群组不存在。</div>
      </div>
    );
  }

  if (group.membershipRole !== "OWNER" && group.membershipRole !== "ADMIN") {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <div className="page-header">
          <button className="icon-btn" aria-label="返回群组" onClick={() => navigate(`/community/${group.id}`)}><Icon name="chevron-left" size={18} /></button>
          <div className="title">群组设置</div>
        </div>
          <div className="route-status"><Icon name="lock" size={20} /><b>仅群主或管理员可以管理此群组</b><span>你可以继续浏览群内公开内容。</span></div>
      </div>
    );
  }

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    const nextName = name.trim() || group.name;
    const result = await performWorkspaceAction(group.id, {
      action: "UPDATE_COMMUNITY",
      name: nextName,
      description: description.trim() || undefined,
    });
    if (result.ok) {
      updateGroup(group.id, { name: nextName, tier: group.tier ?? "初阶" });
      setSaved(true);
    } else {
      setSaveError(result.message);
    }
    setSaving(false);
  };

  async function reviewRequest(
    joinRequest: CommunityJoinRequest,
    decision: "APPROVE" | "REJECT",
  ) {
    if (!groupId || reviewingId) return;
    setReviewingId(joinRequest.id);
    setRequestsError("");
    setReviewMessage("");
    const result = await reviewCommunityJoinRequest(
      groupId,
      joinRequest.id,
      decision,
    );
    if (result.ok) {
      setJoinRequests((current) =>
        current.filter((item) => item.id !== joinRequest.id),
      );
      setReviewMessage(result.message);
    } else {
      setRequestsError(result.message);
    }
    setReviewingId("");
  }

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader title="社群设置" subtitle={group.membershipRole === "ADMIN" ? "管理员" : "群主"} ariaLabel="社群管理" onBack={() => navigate(-1)} backLabel="返回社群" />

      <div className="screen-scroll" style={{ padding: "18px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", flex: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, background: group.color, border: "1px solid var(--line)", borderRadius: 18, boxShadow: "var(--shadow-card)", fontSize: 24, fontWeight: 800 }}>
              {group.letter}
            </div>
            <div aria-label="头像编辑即将开放" title="头像编辑即将开放" style={{ position: "absolute", right: -5, bottom: -5, display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, background: "var(--body)", borderRadius: 100, color: "#fff" }}>
              <Icon name="camera" size={12} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", marginBottom: 5 }}>群组名称</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              style={{ width: "100%", height: 44, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--white)" }}
            />
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "var(--body)", fontSize: 12, fontWeight: 700 }}>
          社群简介
          <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 200))} rows={3} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--white)", color: "var(--ink)", font: "inherit", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
        </label>

        {/* join requests */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)" }}>加入申请</div>
            {!requestsLoading && (
              <div style={{ minWidth: 20, height: 20, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 100, background: joinRequests.length ? "rgba(225,49,125,.11)" : "var(--surface-2)", color: joinRequests.length ? "var(--pink)" : "var(--body)", fontSize: 11, fontWeight: 800 }}>
                {joinRequests.length}
              </div>
            )}
          </div>

          {requestsLoading && (
            <div className="card" style={{ padding: "16px", fontSize: 12, color: "var(--body)" }}>正在读取加入申请…</div>
          )}
          {!requestsLoading && joinRequests.length === 0 && !requestsError && (
            <div className="card" style={{ padding: "16px", fontSize: 12, color: "var(--body)" }}>目前没有待处理的加入申请</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {joinRequests.map((joinRequest) => {
              const busy = reviewingId === joinRequest.id;
              return (
                <div key={joinRequest.id} className="card" style={{ padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {joinRequest.user.avatarUrl ? (
                      <img src={joinRequest.user.avatarUrl} alt="" style={{ width: 42, height: 42, flex: "none", borderRadius: 100, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 42, height: 42, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 100, background: joinRequest.user.avatarColor, fontSize: 16, fontWeight: 800 }}>
                        {Array.from(joinRequest.user.name)[0] ?? "友"}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{joinRequest.user.name}</div>
                      <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "var(--body)" }}>
                        {joinRequest.user.email ?? "已注册用户"} · {requestTime(joinRequest.createdAt)}
                      </div>
                    </div>
                  </div>
                  {joinRequest.message && (
                    <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12, color: "var(--body)", lineHeight: 1.55 }}>
                      {joinRequest.message}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                    <button className="compact-action-btn" disabled={Boolean(reviewingId)} onClick={() => reviewRequest(joinRequest, "REJECT")}>
                      {busy ? "处理中…" : "拒绝"}
                    </button>
                    <button className="compact-action-btn is-primary" disabled={Boolean(reviewingId)} onClick={() => reviewRequest(joinRequest, "APPROVE")}>
                      {busy ? "处理中…" : "批准加入"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {reviewMessage && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#267A45" }}>{reviewMessage}</div>
          )}
          {requestsError && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--pink)" }}>{requestsError}</div>
          )}
        </section>

        {/* tier cards */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)", marginBottom: 10 }}>群组等级</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TIERS.map((t) => {
              const active = tier === t.id;
              const available = t.id === "初阶";
              return (
                <button
                  key={t.id}
                  disabled={!available}
                  aria-describedby={!available ? `tier-${t.id}-status` : undefined}
                  onClick={() => available && setTier(t.id)}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left", border: active ? "2px solid var(--purple)" : "1px solid var(--line)", opacity: available ? 1 : 0.62, cursor: available ? "pointer" : "not-allowed" }}
                >
                  <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 100, border: active ? "7px solid var(--purple)" : "2px solid var(--line)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{t.id}</div>
                      {group.tier === t.id && (
                        <div style={{ fontSize: 10, fontWeight: 800, background: "var(--yellow)", borderRadius: 6, padding: "2px 6px" }}>当前</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{t.members} · {t.ai}</div>
                  </div>
                  <div id={`tier-${t.id}-status`} style={{ fontSize: 12, fontWeight: 800, color: active ? "var(--purple)" : "var(--body)", textAlign: "right" }}>{available ? t.price : <>{t.price}<br /><small>联系平台开通</small></>}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* danger zone hint */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px" }}>
          <Icon name="lock" size={15} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            AI 助手人设、解散社群等高级操作在网页版群主工作台提供。
          </div>
        </div>

        {saveError && <div role="alert" style={{ color: "var(--pink)", fontSize: 12, fontWeight: 700 }}>{saveError}</div>}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saved ? "已保存 ✓" : saving ? "保存中…" : "保存修改"}
        </button>
      </div>
    </div>
  );
}
