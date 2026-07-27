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
import {
  fetchCommunityWorkspace,
  performWorkspaceAction,
  type CommunityWorkspace,
} from "../data/community-workspace";

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
  const [joinPolicy, setJoinPolicy] =
    useState<CommunityWorkspace["community"]["joinPolicy"]>("APPROVAL");
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
  const [accessRole, setAccessRole] =
    useState<CommunityWorkspace["access"]["role"] | null>(null);
  const [accessError, setAccessError] = useState("");
  const [planLabel, setPlanLabel] = useState("当前方案");
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
    if (!groupId) return;
    let active = true;
    setAccessAllowed(null);
    setAccessError("");
    void fetchCommunityWorkspace(groupId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setAccessAllowed(result.workspace.access.isAdmin);
        setAccessRole(result.workspace.access.role);
        setPlanLabel(result.workspace.entitlements.label);
        if (!result.workspace.community.isOfficial) {
          setJoinPolicy(result.workspace.community.joinPolicy);
        }
      } else {
        setAccessAllowed(false);
        setAccessError(result.message);
      }
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

  if (accessAllowed === null) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <UnifiedHeader title="社群设置" subtitle="确认权限" ariaLabel="社群管理" onBack={() => navigate(-1)} backLabel="返回社群" />
        <div className="route-status">正在确认管理权限…</div>
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <div className="page-header">
          <button className="icon-btn" aria-label="返回社群" onClick={() => navigate(`/community/${group.id}`)}><Icon name="chevron-left" size={18} /></button>
          <div className="title">社群设置</div>
        </div>
          <div className="route-status"><Icon name="lock" size={20} /><b>无法进入社群管理</b><span>{accessError || "仅群主或管理员可以管理此群组。"}</span></div>
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
    if (!result.ok) {
      setSaveError(result.message);
      setSaving(false);
      return;
    }
    const policyResult = await performWorkspaceAction(group.id, {
      action: "UPDATE_JOIN_POLICY",
      joinPolicy,
    });
    if (!policyResult.ok) {
      setSaveError(policyResult.message);
      setSaving(false);
      return;
    }
    updateGroup(group.id, { name: nextName, tier: group.tier ?? "初阶" });
    setSaved(true);
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
      <UnifiedHeader title="社群设置" subtitle={accessRole === "ADMIN" ? "管理员" : "群主"} ariaLabel="社群管理" onBack={() => navigate(-1)} backLabel="返回社群" />

      <div className="screen-scroll" style={{ padding: "18px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, background: group.color, border: "1px solid var(--line)", borderRadius: 18, boxShadow: "var(--shadow-card)", fontSize: 24, fontWeight: 800 }}>
              {group.letter}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--body)", marginBottom: 5 }}>社群名称</div>
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

        <section>
          <div style={{ marginBottom: 9, fontSize: 12, fontWeight: 800, color: "var(--body)" }}>加入方式</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 }}>
            {([
              ["OPEN", "直接加入", "无需审核"],
              ["APPROVAL", "申请加入", "管理员审核"],
              ["INVITE_ONLY", "仅限邀请", "不可搜索加入"],
            ] as Array<[CommunityWorkspace["community"]["joinPolicy"], string, string]>).map(([value, label, detail]) => (
              <button
                type="button"
                key={value}
                aria-pressed={joinPolicy === value}
                onClick={() => setJoinPolicy(value)}
                style={{
                  minWidth: 0,
                  minHeight: 58,
                  padding: "8px 5px",
                  border: 0,
                  borderRadius: 12,
                  background: joinPolicy === value ? "rgba(191,120,246,.13)" : "var(--surface-2)",
                  color: joinPolicy === value ? "var(--purple)" : "var(--body)",
                  textAlign: "center",
                }}
              >
                <b style={{ display: "block", fontSize: 11 }}>{label}</b>
                <small style={{ display: "block", marginTop: 3, fontSize: 8, fontWeight: 650 }}>{detail}</small>
              </button>
            ))}
          </div>
        </section>

        {/* join requests */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)" }}>加入申请</div>
            {!requestsLoading && (
              <div style={{ minWidth: 20, height: 20, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 100, background: joinRequests.length ? "rgba(225,49,125,.11)" : "var(--surface-2)", color: joinRequests.length ? "var(--pink)" : "var(--body)", fontSize: 12, fontWeight: 800 }}>
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
                      <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--body)" }}>
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

        <section>
          <div style={{ marginBottom: 9, fontSize: 12, fontWeight: 800, color: "var(--body)" }}>当前方案</div>
          <div className="card" style={{ display: "flex", minHeight: 54, alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px" }}>
            <div>
              <b style={{ display: "block", fontSize: 14 }}>{planLabel}</b>
              <small style={{ display: "block", marginTop: 3, color: "var(--body)", fontSize: 11, fontWeight: 650 }}>当前社群服务方案</small>
            </div>
            <span style={{ padding: "4px 8px", borderRadius: 99, background: "var(--yellow)", fontSize: 10, fontWeight: 800 }}>使用中</span>
          </div>
        </section>

        {saveError && <div role="alert" style={{ color: "var(--pink)", fontSize: 12, fontWeight: 700 }}>{saveError}</div>}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saved ? "已保存 ✓" : saving ? "保存中…" : "保存修改"}
        </button>
      </div>
    </div>
  );
}
