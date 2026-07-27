import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { fetchCommunityGroups, type Group } from "../data/community";

export function CommunityPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [canCreateCommunity, setCanCreateCommunity] = useState(false);
  const official = groups.find((group) => group.badgeStyle === "official");
  const joined = groups.filter((group) => group.badgeStyle !== "official");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchCommunityGroups().then((result) => {
      if (!active) return;
      if (result.ok) {
        setGroups(result.groups);
        setAuthenticated(result.authenticated);
        setCanCreateCommunity(result.canCreateCommunity);
      } else {
        setGroups([]);
        setAuthenticated(null);
        setCanCreateCommunity(false);
        setError(result.message);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const row = (g: (typeof groups)[number]) => (
    <Link
      key={g.id}
      to={g.badgeStyle === "official" && authenticated === false
        ? "/me/login"
        : `/community/${g.id}`}
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
      <Icon name="chevron-right" size={17} />
    </Link>
  );

  return (
    <div className="screen community-directory-screen">
      <UnifiedHeader
        title="社群"
        subtitle={loading ? "读取中" : `${groups.length} 个`}
        ariaLabel="社群概览"
        actions={authenticated === true && canCreateCommunity ? (
          <button className="bible-toolbar-action" aria-label="创建社群" onClick={() => navigate("/community/new")}>
            <Icon name="edit" size={19} />
          </button>
        ) : undefined}
      />

      <div className="screen-scroll community-directory-scroll">
        {official && <div className="community-directory-list is-featured">{row(official)}</div>}
        {loading && (
          <div className="community-directory-status">正在读取社群…</div>
        )}
        {error && (
          <div className="community-directory-error">{error}</div>
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
          </section>
        )}
      </div>
    </div>
  );
}
