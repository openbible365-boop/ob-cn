import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { CommunityErrorState } from "../components/community/CommunityServiceState";
import {
  fetchCommunityGroups,
  requestCommunityJoin,
  type Group,
} from "../data/community";
import {
  fetchCommunityServiceHealth,
  type CommunityServiceHealth,
} from "../data/community-health";

export function CommunityPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [serviceHealth, setServiceHealth] = useState<CommunityServiceHealth | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [canCreateCommunity, setCanCreateCommunity] = useState(false);
  const [discoverableGroups, setDiscoverableGroups] = useState<Group[]>([]);
  const [showDiscover, setShowDiscover] = useState(false);
  const [search, setSearch] = useState("");
  const [joiningId, setJoiningId] = useState("");
  const [searching, setSearching] = useState(false);
  const [directoryMessage, setDirectoryMessage] = useState("");
  const official = groups.find((group) => group.badgeStyle === "official");
  const joined = groups.filter((group) => group.badgeStyle !== "official");
  const ownedGroup = groups.find((group) => group.membershipRole === "OWNER");

  const loadDirectory = useCallback(async (keyword = "") => {
    setLoading(true);
    setError("");
    setErrorStatus(null);
    const [directory, health] = await Promise.all([
      fetchCommunityGroups({ allowStale: true, keyword }),
      fetchCommunityServiceHealth(),
    ]);
    setServiceHealth(health.health);
    if (directory.ok) {
      setGroups(directory.groups);
      setDiscoverableGroups(directory.discoverableGroups);
      setAuthenticated(directory.authenticated);
      setCanCreateCommunity(directory.canCreateCommunity);
    } else {
      setGroups([]);
      setDiscoverableGroups([]);
      setAuthenticated(null);
      setCanCreateCommunity(false);
      setError(directory.message);
      setErrorStatus(directory.status ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    if (active) void loadDirectory();
    return () => {
      active = false;
    };
  }, [loadDirectory]);

  // 关键词交给服务端搜索全部可加入社群，输入停顿后再发请求。
  useEffect(() => {
    if (!showDiscover) return;
    const keyword = search.trim();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void loadDirectory(keyword).finally(() => setSearching(false));
    }, keyword ? 320 : 0);
    return () => window.clearTimeout(timer);
  }, [search, showDiscover, loadDirectory]);

  const row = (g: (typeof groups)[number]) => (
    <Link
      key={g.id}
      to={`/community/${g.id}`}
      className={`community-directory-row${g.badgeStyle === "official" ? " is-official" : ""}`}
    >
      <div className="community-directory-avatar" style={{ background: g.color }}>
        {g.letter}
      </div>
      <div className="community-directory-copy">
        <div className="community-directory-title">
          <b>{g.name}</b>
          {g.badge && (
            <span className={`community-directory-badge is-${g.badgeStyle ?? "muted"}`}>
              {g.badge}
            </span>
          )}
          {(g.pendingJoinRequestCount ?? 0) > 0 && (
            <span className="community-directory-badge is-alert">{g.pendingJoinRequestCount} 个申请</span>
          )}
        </div>
        <small>{g.badgeStyle === "official" ? `公共空间 · ${g.desc}` : `私有空间 · ${g.desc}`}</small>
      </div>
      <Icon name="chevron-right" size={16} />
    </Link>
  );


  async function joinCommunity(group: Group) {
    if (joiningId) return;
    setJoiningId(group.id);
    setDirectoryMessage("");
    const result = await requestCommunityJoin(group.id);
    if (result.status === 401) {
      navigate("/me/login");
      return;
    }
    setDirectoryMessage(result.message);
    if (result.ok) await loadDirectory();
    setJoiningId("");
  }

  return (
    <div className="screen community-directory-screen">
      <UnifiedHeader
        title="社群"
        subtitle={loading ? "读取中" : `${groups.length} 个`}
        ariaLabel="社群概览"
        // 只在真能创建时才显示入口。达到「一人一群」上限时不留禁用按钮——
        // 列表下方那行说明已经把原因讲清楚了，再摆一个点不动的图标只是噪音。
        actions={authenticated === true && canCreateCommunity ? (
          <button data-icon-button="default"
            className="bible-toolbar-action"
            aria-label="创建社群"
            title="创建社群"
            onClick={() => navigate("/community/new")}
          >
            <Icon name="edit" size={20} />
          </button>
        ) : undefined}
      />

      <div className="screen-scroll community-directory-scroll">
        {official && <div className="community-directory-list is-featured">{row(official)}</div>}
        {authenticated === false && !loading && !error && (
          <div className="community-directory-login-note">
            <span>登录后可创建社群、参加活动和保存互动记录</span>
            <button type="button" onClick={() => navigate("/me/login")}>登录</button>
          </div>
        )}
        {loading && (
          <div className="community-directory-status">正在读取社群…</div>
        )}
        {error && (
          <CommunityErrorState
            title={errorStatus === 401 ? "请先登录" : undefined}
            message={error}
            status={errorStatus}
            health={serviceHealth}
            onRetry={() => void loadDirectory()}
            onBack={() => navigate("/bible")}
          />
        )}
        {authenticated === true && (
          <section className="community-directory-section">
            <div className="community-directory-section-title">
              <b>我的社群与小组</b>
              <span>{joined.length}</span>
            </div>
            {!loading && !error && joined.length === 0 && (
              <div className="community-directory-status">还没有加入其他社群</div>
            )}
            {joined.length > 0 && <div className="community-directory-list">{joined.map(row)}</div>}
            {!loading && !error && !canCreateCommunity && ownedGroup && (
              <div className="community-directory-note">
                每位用户只能创建一个社群，你已经创建了「{ownedGroup.name}」。
              </div>
            )}
            <button
              type="button"
              className="community-discover-toggle"
              onClick={() => setShowDiscover((value) => !value)}
            >
              <Icon name="search" size={16} />
              {showDiscover ? "收起发现社群" : "搜索或发现社群"}
            </button>
            {showDiscover && (
              <div className="community-discover-panel">
                <label>
                  <Icon name="search" size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索社群名称或介绍"
                    aria-label="搜索可加入社群"
                  />
                </label>
                {directoryMessage && <div className="community-feedback" role="status">{directoryMessage}</div>}
                {searching ? (
                  <div className="community-directory-status">正在搜索…</div>
                ) : discoverableGroups.length === 0 ? (
                  <div className="community-directory-status">
                    {search.trim() ? "没有找到匹配的社群" : "暂时没有可发现的社群"}
                  </div>
                ) : (
                  <div className="community-discover-list">
                    {discoverableGroups.map((group) => (
                      <div key={group.id} className="community-discover-row">
                        <span style={{ background: group.color }}>{group.letter}</span>
                        <div><b>{group.name}</b><small>{group.desc}</small></div>
                        <button type="button" disabled={Boolean(joiningId)} onClick={() => void joinCommunity(group)}>
                          {joiningId === group.id ? "处理中" : group.joinPolicy === "OPEN" ? "加入" : "申请"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
