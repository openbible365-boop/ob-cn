import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { getGroup, updateGroup } from "../data/community";

const TIERS = [
  { id: "初阶", members: "50 成员", ai: "基础 AI 额度", price: "免费" },
  { id: "中阶", members: "200 成员", ai: "进阶 AI 额度 + 知识库", price: "¥30/月" },
  { id: "高阶", members: "1000 成员", ai: "高额 AI 额度 + 专属人设", price: "¥98/月" },
];

// 群组设置（design 4f，仅群主可见）
export function GroupSettingsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const group = getGroup(groupId ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [tier, setTier] = useState(group?.tier ?? "初阶");
  const [saved, setSaved] = useState(false);

  if (!group) {
    return (
      <div className="screen">
        <div className="page-header">
          <button className="icon-btn" onClick={() => navigate("/community")}><Icon name="chevron-left" size={18} /></button>
          <div className="title">群组设置</div>
        </div>
        <div style={{ padding: 24, fontSize: 13, color: "var(--body)" }}>群组不存在。</div>
      </div>
    );
  }

  const save = () => {
    updateGroup(group.id, { name: name.trim() || group.name, tier });
    setSaved(true);
    setTimeout(() => navigate(`/community/${group.id}`), 600);
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)}><Icon name="chevron-left" size={18} /></button>
        <div className="title">群组设置</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, fontWeight: 700, background: "rgba(191,120,246,.16)", color: "var(--purple)", borderRadius: 6, padding: "3px 8px" }}>群主</div>
      </div>

      <div className="screen-scroll" style={{ padding: "18px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", flex: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, background: group.color, border: "1px solid var(--line)", borderRadius: 18, boxShadow: "var(--shadow-card)", fontSize: 24, fontWeight: 800 }}>
              {group.letter}
            </div>
            <div style={{ position: "absolute", right: -5, bottom: -5, display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "var(--ink)", borderRadius: 100, color: "#fff" }}>
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

        {/* tier cards */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)", marginBottom: 10 }}>群组等级</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TIERS.map((t) => {
              const active = tier === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTier(t.id)}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left", border: active ? "2px solid var(--purple)" : "1px solid var(--line)" }}
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
                  <div style={{ fontSize: 13, fontWeight: 800, color: active ? "var(--purple)" : "var(--body)" }}>{t.price}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* danger zone hint */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px" }}>
          <Icon name="lock" size={15} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            成员管理、AI 助手人设、解散群组等操作在网页版群主工作台提供。
          </div>
        </div>

        <button className="btn-primary" onClick={save}>
          {saved ? "已保存 ✓" : "保存修改"}
        </button>
      </div>
    </div>
  );
}
