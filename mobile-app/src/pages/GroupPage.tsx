import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  getGroup,
  getPosts,
  getMyLikes,
  toggleLike,
  getEvents,
  getMySignups,
  toggleSignup,
} from "../data/community";

const TABS = [
  { id: "chat", label: "交流" },
  { id: "info", label: "信息" },
  { id: "events", label: "活动" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// 分社群（design 4b 信息 / 4c 交流 / 4d 活动）
export function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const group = getGroup(groupId ?? "");
  const [tab, setTab] = useState<TabId>("info");
  const [version, setVersion] = useState(0);
  void version;

  if (!group) {
    return (
      <div className="screen">
        <div className="page-header">
          <button className="icon-btn" onClick={() => navigate("/community")}><Icon name="chevron-left" size={18} /></button>
          <div className="title">社群</div>
        </div>
        <div style={{ padding: 24, fontSize: 13, color: "var(--body)" }}>群组不存在。</div>
      </div>
    );
  }

  const posts = getPosts(group.id);
  const myLikes = getMyLikes();
  const events = getEvents(group.id);
  const mySignups = getMySignups();

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      {/* header */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 12px", background: "var(--white)" }}>
        <button className="icon-btn" onClick={() => navigate("/community")}><Icon name="chevron-left" size={18} /></button>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: group.color, borderRadius: 10, fontSize: 15, fontWeight: 800 }}>
          {group.letter}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{group.name}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>32 成员</div>
        </div>
        <button className="pill-btn"><Icon name="share" size={13} /> 邀请</button>
        <button className="pill-btn" title="仅群主可见" onClick={() => navigate(`/community/${group.id}/settings`)}>
          <Icon name="settings" size={13} /> 设置
        </button>
      </div>

      {/* sub tabs */}
      <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "var(--white)", borderBottom: "1px solid var(--line)", padding: "0 16px" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 42, fontSize: 14, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? "var(--ink)" : "var(--body)" }}>
            {t.label}
            {tab === t.id && (
              <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 3, background: "var(--purple)", borderRadius: 100 }} />
            )}
          </button>
        ))}
      </div>

      {/* 信息 */}
      {tab === "info" && (
        <>
          <div className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--yellow)", borderRadius: 16, boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--ink)", color: "#fff", padding: "3px 6px", borderRadius: 6 }}>公告</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>群主 · 王弟兄 · 置顶</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.7 }}>本周五 20:00 线上共读约翰福音 3 章，到「活动」页一键报名。</div>
            </div>

            {posts.map((p) => {
              const liked = myLikes.includes(p.id);
              return (
                <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: p.avatarColor, borderRadius: 100, fontSize: 13, fontWeight: 800 }}>
                      {p.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{p.author}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{p.time}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.75, marginBottom: 10 }}>{p.text}</div>
                  {p.verseRef && (
                    <div
                      onClick={() => navigate("/bible?c=3")}
                      style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(191,120,246,.10)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--purple)", marginBottom: 3 }}>{p.verseRef}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--body)", lineHeight: 1.6 }}>{p.verseText}</div>
                      </div>
                      <div style={{ color: "var(--purple)" }}><Icon name="chevron-right" size={16} /></div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--body)" }}>
                    <button
                      onClick={() => { toggleLike(p.id); setVersion((v) => v + 1); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: liked ? "var(--pink)" : "var(--body)" }}
                    >
                      <Icon name="heart" size={14} /> {p.likes + (liked ? 1 : 0)}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700 }}>
                      <Icon name="message-square" size={14} /> {p.comments}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: "none", background: "var(--white)", borderTop: "1px solid var(--line)", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", display: "flex", gap: 10, alignItems: "center" }}>
            <button className="icon-btn" style={{ width: 42, height: 42 }} title="添加图片"><Icon name="image" size={18} /></button>
            <div style={{ flex: 1, display: "flex", alignItems: "center", height: 42, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500, color: "var(--body)" }}>
              分享此刻的领受…
            </div>
            <button className="icon-btn" style={{ width: 42, height: 42, background: "var(--purple)", color: "#fff" }}><Icon name="send" size={18} /></button>
          </div>
        </>
      )}

      {/* 交流 */}
      {tab === "chat" && (
        <>
          <div className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(191,120,246,.14)", borderRadius: 16, padding: "12px 14px" }}>
              <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "var(--purple)", borderRadius: 100, color: "#fff" }}>
                <Icon name="sparkle" size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>灵修小助手</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>本群专属 AI 助理 · 人设由群主配置</div>
              </div>
            </div>
            <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", padding: "10px 14px", fontSize: 13, fontWeight: 500, lineHeight: 1.7, color: "var(--body)" }}>
              平安！我是灵修小助手。查经中有任何经文或信仰疑问，随时问我。
            </div>
            <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, maxWidth: "82%" }}>
              <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 12, padding: "9px 12px", fontSize: 14, fontWeight: 600, lineHeight: 1.6, boxShadow: "var(--shadow-card)" }}>
                「重生」和「悔改」有什么区别？
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--body)" }}>
                <Icon name="eye" size={11} /> 群内公开 · 沉淀至知识库
              </div>
            </div>
            <div className="card" style={{ borderRadius: 12, padding: 14 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500 }}>
                好问题！简单说：<b style={{ color: "var(--ink)" }}>悔改</b>（metanoia）是人的回应——心思与方向的转变；<b style={{ color: "var(--ink)" }}>重生</b>（约 3:3）是神的作为——圣灵赐下全新的生命。
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500 }}>
                两者相伴发生：悔改是重生生命的第一个记号，而重生是悔改得以持续的动力源泉。
              </p>
            </div>
            <div className="disclaimer">回复遵循群主人设与平台释经规范双层约束</div>
          </div>
          <div style={{ flex: "none", background: "var(--white)", borderTop: "1px solid var(--line)", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>对话可见性</div>
              <div className="seg">
                <div className="seg-item">仅自己可见</div>
                <div className="seg-item active">群内公开</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", height: 46, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500, color: "var(--body)" }}>
                向灵修小助手提问…
              </div>
              <button className="icon-btn" style={{ width: 46, height: 46, background: "var(--purple)", color: "#fff" }}><Icon name="send" size={20} /></button>
            </div>
          </div>
        </>
      )}

      {/* 活动 */}
      {tab === "events" && (
        <div className="screen-scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="seg" style={{ alignSelf: "flex-start" }}>
            <div className="seg-item active">进行中</div>
            <div className="seg-item">未开始</div>
            <div className="seg-item">已结束</div>
          </div>

          {events.map((e) => {
            const signedUp = mySignups.includes(e.id);
            const total = e.signups + (signedUp ? 1 : 0);
            return (
              <div key={e.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "3px 8px", background: e.tagStyle === "purple" ? "rgba(191,120,246,.16)" : "rgba(233,130,100,.2)", color: e.tagStyle === "purple" ? "var(--purple)" : "var(--orange-deep)" }}>
                    {e.tag}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>{e.status}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{e.title}</div>
                {e.when && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 4 }}>
                    <Icon name="calendar" size={13} /> {e.when}
                  </div>
                )}
                {e.where && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 12 }}>
                    <Icon name="map-pin" size={13} /> {e.where}
                  </div>
                )}
                {e.note && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 12 }}>
                    <Icon name="check" size={13} /> {e.note}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {e.capacity != null ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 100, marginBottom: 5 }}>
                        <div style={{ width: `${Math.min(100, (total / e.capacity) * 100)}%`, height: "100%", background: "var(--purple)", borderRadius: 100 }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>已报名 {total}/{e.capacity}</div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
                      <Icon name="bell" size={13} /> {e.reminder}
                    </div>
                  )}
                  <button
                    onClick={() => { toggleSignup(e.id); setVersion((v) => v + 1); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", height: 40, padding: "0 18px",
                      borderRadius: 100, fontSize: 13, fontWeight: 700, boxShadow: "var(--shadow-card)",
                      ...(e.capacity != null
                        ? signedUp
                          ? { background: "var(--white)", border: "1px solid var(--line)", color: "var(--ink)" }
                          : { background: "var(--purple)", color: "#fff" }
                        : { background: "var(--white)", border: "1px solid var(--line)", color: "var(--ink)" }),
                    }}
                  >
                    {e.capacity != null ? (signedUp ? "已报名 · 取消" : "一键报名") : "去打卡"}
                  </button>
                </div>
              </div>
            );
          })}

          {mySignups.some((id) => events.some((e) => e.id === id && e.capacity != null)) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(191,120,246,.14)", borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ color: "var(--purple)" }}><Icon name="check" size={15} /></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>
                你已报名「约翰福音 3 章共读」，开始前 2 小时将收到提醒。
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
