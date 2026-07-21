import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CompactToolbar } from "../components/CompactToolbar";
import { getConversations } from "../data/huidu";

function fmtTime(iso: string) {
  return iso.slice(11, 16);
}

function isToday(iso: string) {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

// 慧读首页（design 3a）
export function HuiduHomePage() {
  const navigate = useNavigate();
  const conversations = getConversations();
  const [grouping, setGrouping] = useState<"time" | "book">("time");
  const today = conversations.filter((c) => isToday(c.createdAt));
  const earlier = conversations.filter((c) => !isToday(c.createdAt));

  const item = (c: (typeof conversations)[number], highlight: boolean) => (
    <Link key={c.id} to={`/huidu/${c.id}`} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 800, background: highlight ? "var(--yellow)" : "var(--surface-2)", borderRadius: 6, padding: "2px 8px" }}>
            {c.refLabel}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
            {Math.ceil(c.messages.length / 2)} 轮 · {fmtTime(c.createdAt)}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{c.title}</div>
      </div>
      <div style={{ color: "var(--body)" }}><Icon name="chevron-right" size={16} /></div>
    </Link>
  );

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <CompactToolbar
        ariaLabel="慧读与今日额度"
        primary="慧读"
        secondary={`本机 ${conversations.length}`}
        actions={(
          <>
            <button className="bible-toolbar-action" aria-label="返回圣经阅读" onClick={() => navigate("/bible")}>
              <Icon name="book" size={20} />
            </button>
            <button className="bible-toolbar-action" aria-label="开始新的慧读对话" onClick={() => navigate("/bible")}>
              <Icon name="sparkle" size={20} />
            </button>
          </>
        )}
      />

      <div className="screen-scroll" style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <button
          onClick={() => navigate("/bible")}
          style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--purple)", borderRadius: 16, boxShadow: "var(--shadow-card)", padding: "18px 16px", textAlign: "left" }}
        >
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "rgba(255,255,255,.25)", borderRadius: 100, color: "#fff" }}>
            <Icon name="star" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 2 }}>开始新对话</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.85)" }}>也可在阅读页划线经文，直达慧读</div>
          </div>
          <div style={{ color: "#fff" }}><Icon name="chevron-right" size={18} /></div>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--body)" }}>历史存档</div>
          <div style={{ flex: 1 }} />
          <div className="seg" role="group" aria-label="慧读历史排序">
            <button type="button" className={`seg-item${grouping === "time" ? " active" : ""}`} aria-pressed={grouping === "time"} onClick={() => setGrouping("time")}>按时间</button>
            <button type="button" className={`seg-item${grouping === "book" ? " active" : ""}`} aria-pressed={grouping === "book"} onClick={() => setGrouping("book")}>按卷章</button>
          </div>
        </div>

        {grouping === "time" && today.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>今天</div>
            {today.map((c, i) => item(c, i === 0))}
          </>
        )}
        {grouping === "time" && earlier.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>更早</div>
            {earlier.map((c) => item(c, false))}
          </>
        )}
        {grouping === "book" && [...conversations]
          .sort((a, b) => a.refLabel.localeCompare(b.refLabel, "zh-CN", { numeric: true }))
          .map((conversation) => item(conversation, false))}
        {conversations.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--body)", padding: "8px 2px" }}>
            还没有慧读记录。在阅读页点选一节经文，选择「慧读」试试。
          </div>
        )}

        <div className="disclaimer">当前回答由本机阅读模板生成，仅供参考，不替代教会教导与权威释经</div>
      </div>
    </div>
  );
}
