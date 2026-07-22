import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CompactToolbar } from "../components/CompactToolbar";
import { Icon } from "../components/Icon";
import { fetchCommunityGroups, type Group } from "../data/community";

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  official: { background: "var(--yellow)", color: "var(--ink)" },
  owner: { background: "rgba(191,120,246,.16)", color: "var(--purple)" },
  muted: { background: "var(--surface-2)", color: "var(--body)", fontWeight: 700 },
};

// 社群主控台（design 4a）
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
      className="card"
      style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}
    >
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, background: g.color, borderRadius: 14, fontSize: 20, fontWeight: 800 }}>
        {g.letter}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{g.name}</div>
          {g.badge && (
            <div style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 6px", ...(BADGE_STYLES[g.badgeStyle ?? "muted"] ?? {}) }}>
              {g.badge}
            </div>
          )}
          {(g.pendingJoinRequestCount ?? 0) > 0 && (
            <div style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 6px", background: "rgba(225,49,125,.11)", color: "var(--pink)" }}>
              {g.pendingJoinRequestCount} 个加入申请
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--body)" }}>{g.memberCount.toLocaleString()} 成员 · {g.desc.replace(/^\d+\s*成员\s*·\s*/, "")}</div>
      </div>
      <div style={{ color: "var(--body)" }}><Icon name="chevron-right" size={18} /></div>
    </Link>
  );

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <CompactToolbar
        ariaLabel="社群概览"
        primary="社群"
        secondary={`已加入 ${joined.length}`}
        actions={authenticated === true && canCreateCommunity ? (
          <button
            className="bible-toolbar-action"
            type="button"
            aria-label="创建群组"
            title="创建群组"
            onClick={() => navigate("/community/new")}
          >
            <Icon name="edit" size={18} />
          </button>
        ) : undefined}
      />

      <div className="screen-scroll" style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {official && row(official)}
        {loading && (
          <div style={{ padding: "18px 4px", fontSize: 13, color: "var(--body)" }}>
            正在从服务器读取社群…
          </div>
        )}
        {error && (
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(225,49,125,.09)", color: "var(--pink)", fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        )}
        {authenticated === true && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)" }}>我加入的社群和小组</div>
            {!loading && !error && joined.length === 0 && (
              <div style={{ padding: "18px 4px", fontSize: 13, color: "var(--body)" }}>
                还没有加入其他社群
              </div>
            )}
            {joined.map(row)}
          </>
        )}
      </div>
    </div>
  );
}
