import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { createGroup } from "../data/community";

const COLORS = ["var(--yellow)", "var(--purple)", "var(--orange)", "var(--pink)"];
const COLOR_NAMES = ["暖黄色", "慧读紫", "珊瑚橙", "玫红色"];

// 创建群组（design 4e）
export function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const g = createGroup(name.trim(), desc.trim(), COLORS[colorIdx]);
    navigate(`/community/${g.id}`, { replace: true });
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)}><Icon name="chevron-left" size={18} /></button>
        <div className="title">创建群组</div>
      </div>

      <div className="screen-scroll" style={{ padding: "18px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 6 }}>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 84, height: 84, background: COLORS[colorIdx], border: "1px solid var(--line)", borderRadius: 22, boxShadow: "var(--shadow-card)", fontSize: 32, fontWeight: 800 }}>
              {name.trim() ? name.trim().slice(0, 1) : "群"}
            </div>
            <div title="使用下方颜色更换头像底色" style={{ position: "absolute", right: -6, bottom: -6, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "var(--ink)", borderRadius: 100, color: "#fff" }}>
              <Icon name="camera" size={14} />
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>点击更换头像（演示：选择底色）</div>
          <div style={{ display: "flex", gap: 8 }}>
            {COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorIdx(i)}
                aria-label={`选择${COLOR_NAMES[i]}头像底色`}
                aria-pressed={i === colorIdx}
                title={COLOR_NAMES[i]}
                style={{ width: 44, height: 44, padding: 7, background: "transparent", borderRadius: 100 }}
              >
                <span aria-hidden="true" style={{ display: "block", width: 28, height: 28, background: c, border: i === colorIdx ? "2px solid var(--ink)" : "1px solid var(--line)", borderRadius: 100 }} />
              </button>
            ))}
          </div>
        </div>

        {/* name */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>群组名称</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{name.length}/20</div>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="例如：青年团契查经组"
            style={{ width: "100%", height: 46, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 600 }}
          />
        </div>

        {/* desc */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>群组简介（可选）</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{desc.length}/60</div>
          </div>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value.slice(0, 60))}
            placeholder="一句话介绍这个群组…"
            rows={3}
            style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500, lineHeight: 1.6, resize: "none", fontFamily: "inherit" }}
          />
        </div>

        {/* tier note */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,212,101,.35)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
          <Icon name="star" size={16} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            新群组默认为「初阶」：50 成员上限 · 基础 AI 助手额度。可在群组设置中升级。
          </div>
        </div>

        <button
          className="btn-primary"
          disabled={!canSubmit}
          onClick={submit}
          style={{ opacity: canSubmit ? 1 : 0.4 }}
        >
          创建群组
        </button>
        <div className="disclaimer">创建即表示同意平台《社群公约》与内容规范；付费升级当前尚未开放。</div>
      </div>
    </div>
  );
}
