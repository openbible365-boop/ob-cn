import { useCallback, useEffect, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { useNavigate, useParams } from "react-router-dom";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { CommunityErrorState } from "../components/community/CommunityServiceState";
import { resolveAvatarUrl } from "../data/api";
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
import {
  fetchCommunityServiceHealth,
  type CommunityServiceHealth,
} from "../data/community-health";

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
  const goBack = useAppBack(`/community/${groupId ?? ""}`);
  // 本地目录缓存只用于首屏占位，社群是否存在一律以服务端结果为准。
  const cachedGroup = getGroup(groupId ?? "");
  const [community, setCommunity] =
    useState<CommunityWorkspace["community"] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] =
    useState<CommunityWorkspace["community"]["joinPolicy"]>("APPROVAL");
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
  const [accessRole, setAccessRole] =
    useState<CommunityWorkspace["access"]["role"] | null>(null);
  const [accessError, setAccessError] = useState("");
  const [accessErrorStatus, setAccessErrorStatus] = useState<number | null>(null);
  const [planLabel, setPlanLabel] = useState("当前方案");
  const [saved, setSaved] = useState(false);
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<CommunityServiceHealth | null>(null);

  const loadJoinRequests = useCallback(async () => {
    if (!groupId) return;
    setRequestsLoading(true);
    setRequestsError("");
    const result = await fetchCommunityJoinRequests(groupId);
    if (result.ok) setJoinRequests(result.requests);
    else setRequestsError(result.message);
    setRequestsLoading(false);
  }, [groupId]);

  const loadAccess = useCallback(async () => {
    if (!groupId) return;
    setAccessAllowed(null);
    setAccessError("");
    setAccessErrorStatus(null);
    const result = await fetchCommunityWorkspace(groupId);
    if (result.ok) {
      setCommunity(result.workspace.community);
      setName(result.workspace.community.name);
      setDescription(result.workspace.community.description ?? "");
      setAccessAllowed(result.workspace.access.isAdmin);
      setAccessRole(result.workspace.access.role);
      setPlanLabel(result.workspace.entitlements.label);
      if (!result.workspace.community.isOfficial) {
        setJoinPolicy(result.workspace.community.joinPolicy);
      }
    } else {
      setAccessAllowed(false);
      setAccessError(result.message);
      setAccessErrorStatus(result.status ?? null);
    }
  }, [groupId]);

  const loadHealth = useCallback(async () => {
    const result = await fetchCommunityServiceHealth();
    setServiceHealth(result.health);
  }, []);

  useEffect(() => {
    void loadJoinRequests();
    void loadAccess();
    void loadHealth();
  }, [loadAccess, loadHealth, loadJoinRequests]);

  useEffect(() => {
    if (!saved || !groupId) return;
    const timer = window.setTimeout(() => navigate(`/community/${groupId}`), 600);
    return () => window.clearTimeout(timer);
  }, [saved, groupId, navigate]);

  if (accessAllowed === null) {
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <UnifiedHeader title="社群设置" subtitle="确认权限" ariaLabel="社群管理" onBack={goBack} backLabel="返回社群" />
        <div className="route-status">正在确认管理权限…</div>
      </div>
    );
  }

  if (!accessAllowed) {
    const notFound = accessErrorStatus === 404;
    const forbidden = accessErrorStatus === 403 || accessErrorStatus === null;
    return (
      <div className="screen" style={{ background: "var(--surface)" }}>
        <UnifiedHeader title="社群设置" subtitle={notFound ? "不存在" : "不可用"} ariaLabel="社群管理" onBack={goBack} backLabel="返回社群" />
        <CommunityErrorState
          title={
            accessErrorStatus === 401
              ? "请先登录"
              : notFound
                ? "社群不存在"
                : forbidden
                  ? "无法进入社群管理"
                  : "无法读取管理权限"
          }
          message={
            forbidden && !accessError
              ? "仅群主或管理员可以管理此群组。"
              : accessError
          }
          status={accessErrorStatus}
          health={serviceHealth}
          onRetry={() => {
            void loadAccess();
            void loadHealth();
          }}
          onBack={goBack}
        />
      </div>
    );
  }

  const groupColor = community?.avatarColor ?? cachedGroup?.color ?? "var(--yellow)";
  const groupLetter = community?.abbreviation ?? cachedGroup?.letter ?? "群";

  const save = async () => {
    if (saving || !groupId) return;
    setSaving(true);
    setSaveError("");
    const nextName = name.trim() || community?.name || "";
    if (!nextName) {
      setSaveError("请填写社群名称");
      setSaving(false);
      return;
    }
    const result = await performWorkspaceAction(groupId, {
      action: "UPDATE_COMMUNITY",
      name: nextName,
      description: description.trim() || undefined,
    });
    if (!result.ok) {
      setSaveError(result.message);
      setSaving(false);
      return;
    }
    if (!community?.isOfficial) {
      const policyResult = await performWorkspaceAction(groupId, {
        action: "UPDATE_JOIN_POLICY",
        joinPolicy,
      });
      if (!policyResult.ok) {
        setSaveError(`社群资料已保存，但加入方式未能更新：${policyResult.message}`);
        setSaving(false);
        return;
      }
    }
    if (cachedGroup) {
      updateGroup(groupId, { name: nextName, tier: cachedGroup.tier ?? "初阶" });
    }
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
    <div className="screen community-settings-screen">
      <UnifiedHeader title="社群设置" subtitle={accessRole === "ADMIN" ? "管理员" : "群主"} ariaLabel="社群管理" onBack={goBack} backLabel="返回社群" />

      <div className="screen-scroll community-settings-scroll">
        <div className="community-settings-identity">
          <span className="community-settings-avatar" style={{ background: groupColor }}>{groupLetter}</span>
          <label className="community-form-field">
            <span>社群名称</span>
            <input value={name} onChange={(event) => setName(event.target.value.slice(0, 20))} />
          </label>
        </div>

        <label className="community-form-field">
          <span>社群简介</span>
          <textarea
            value={description}
            rows={3}
            placeholder="一句话介绍这个社群…"
            onChange={(event) => setDescription(event.target.value.slice(0, 200))}
          />
        </label>

        <section className="community-settings-section">
          <h2>加入方式</h2>
          <div className="community-policy-grid">
            {([
              ["OPEN", "直接加入", "无需审核"],
              ["APPROVAL", "申请加入", "管理员审核"],
              ["INVITE_ONLY", "仅限邀请", "不可搜索加入"],
            ] as Array<[CommunityWorkspace["community"]["joinPolicy"], string, string]>).map(([value, label, detail]) => (
              <button
                type="button"
                key={value}
                aria-pressed={joinPolicy === value}
                className={joinPolicy === value ? "is-active" : ""}
                onClick={() => setJoinPolicy(value)}
              >
                <b>{label}</b>
                <small>{detail}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="community-settings-section">
          <h2>加入申请{!requestsLoading && <em className={joinRequests.length ? "is-pending" : ""}>{joinRequests.length}</em>}</h2>

          {requestsLoading && <div className="card community-settings-note">正在读取加入申请…</div>}
          {!requestsLoading && joinRequests.length === 0 && !requestsError && (
            <div className="card community-settings-note">目前没有待处理的加入申请</div>
          )}
          <div className="community-settings-request-list">
            {joinRequests.map((joinRequest) => {
              const busy = reviewingId === joinRequest.id;
              return (
                <div key={joinRequest.id} className="card community-settings-request">
                  <div className="community-person-row">
                    {joinRequest.user.avatarUrl ? (
                      <img src={resolveAvatarUrl(joinRequest.user.avatarUrl) ?? ""} alt="" />
                    ) : (
                      <span style={{ background: joinRequest.user.avatarColor }}>
                        {Array.from(joinRequest.user.name)[0] ?? "友"}
                      </span>
                    )}
                    <div>
                      <b>{joinRequest.user.name}</b>
                      <small>{joinRequest.user.email ?? "已注册用户"} · {requestTime(joinRequest.createdAt)}</small>
                    </div>
                  </div>
                  {joinRequest.message && <p>{joinRequest.message}</p>}
                  <div className="community-join-request-actions">
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
          {reviewMessage && <div className="community-settings-success" role="status">{reviewMessage}</div>}
          {requestsError && (
            <div role="alert" className="community-settings-error">
              <span>{requestsError}</span>
              <button type="button" className="compact-action-btn" onClick={() => void loadJoinRequests()}>重试</button>
            </div>
          )}
        </section>

        <section className="community-settings-section">
          <h2>当前方案</h2>
          <div className="card community-settings-plan">
            <div>
              <b>{planLabel}</b>
              <small>当前社群服务方案</small>
            </div>
            <span>使用中</span>
          </div>
        </section>

        {saveError && <div role="alert" className="community-settings-error"><span>{saveError}</span></div>}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saved ? "已保存 ✓" : saving ? "保存中…" : "保存修改"}
        </button>
      </div>
    </div>
  );
}
