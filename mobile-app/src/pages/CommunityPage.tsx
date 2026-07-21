import { Link, useNavigate } from "react-router-dom";
import { CompactToolbar } from "../components/CompactToolbar";
import { Icon } from "../components/Icon";
import { getGroups } from "../data/community";

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  official: { background: "var(--yellow)", color: "var(--ink)" },
  owner: { background: "rgba(191,120,246,.16)", color: "var(--purple)" },
  muted: { background: "var(--surface-2)", color: "var(--body)", fontWeight: 700 },
};

// 社群主控台（design 4a）
export function CommunityPage() {
  const navigate = useNavigate();
  const groups = getGroups();
  const [official, ...joined] = groups;

  const row = (g: (typeof groups)[number]) => (
    <Link key={g.id} to={`/community/${g.id}`} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
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
        actions={(
          <button
            className="bible-toolbar-action"
            type="button"
            aria-label="创建群组"
            title="创建群组"
            onClick={() => navigate("/community/new")}
          >
            <Icon name="edit" size={18} />
          </button>
        )}
      />

      <div className="screen-scroll" style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {official && row(official)}
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)" }}>我加入的群组</div>
        {joined.map(row)}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(191,120,246,.14)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ flex: "none", color: "var(--purple)" }}><Icon name="share" size={18} /></div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            收到邀请链接或二维码？打开即可直接进入申请 / 加入流程。
          </div>
        </div>
      </div>
    </div>
  );
}
