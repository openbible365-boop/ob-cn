import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UserAvatar } from "../components/UserAvatar";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { getHighlights, getNotes } from "../data/annotations";
import { getConversations } from "../data/huidu";
import { fetchMe, type SessionUser } from "../data/profile";

export function AccountDataPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [exported, setExported] = useState(false);
  const highlights = getHighlights();
  const notes = getNotes();
  const conversations = getConversations();

  useEffect(() => {
    let active = true;
    void fetchMe().then((value) => {
      if (active) setUser(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const exportLocalData = () => {
    const payload = {
      format: "openbible-local-data",
      version: 1,
      exportedAt: new Date().toISOString(),
      highlights,
      notes,
      conversations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `openbible-local-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
    setExported(true);
  };

  return (
    <div className="screen me-subpage">
      <UnifiedHeader
        title="数据与账户"
        subtitle={user?.entitlements.label ?? "读取中"}
        ariaLabel="数据与账户"
        onBack={() => navigate("/me")}
        backLabel="返回我的"
      />
      <main className="screen-scroll me-detail-scroll">
        <section className="me-data-account">
          <UserAvatar
            className="me-data-avatar"
            name={user?.name ?? "我"}
            avatarColor={user?.avatarColor ?? "var(--yellow)"}
            avatarUrl={user?.avatarUrl ?? null}
            size={44}
          />
          <div>
            <b>{user?.name ?? "正在读取账号…"}</b>
            <span>{user?.email ?? "已登录账户"}</span>
          </div>
        </section>

        {/* 本机数据：与「我的」页同一套宫格语言，数字可点直达对应列表 */}
        <section className="me-data-section">
          <div className="me-data-heading">
            <div>
              <h2>本机数据</h2>
              <p>笔记和慧读仅保存在当前设备，点格子直接查看。</p>
            </div>
            <span>{highlights.length + notes.length + conversations.length} 条</span>
          </div>
          <div className="me-quick is-three">
            <button type="button" onClick={() => navigate("/me/content?t=highlights")}>
              <Icon name="star" size={20} />
              <span>高亮</span>
              <b className="me-quick-count">{highlights.length}</b>
            </button>
            <button type="button" onClick={() => navigate("/me/content?t=notes")}>
              <Icon name="edit" size={20} />
              <span>笔记</span>
              <b className="me-quick-count">{notes.length}</b>
            </button>
            <button type="button" onClick={() => navigate("/huidu")}>
              <Icon name="sparkle" size={20} />
              <span>慧读</span>
              <b className="me-quick-count">{conversations.length}</b>
            </button>
          </div>
        </section>

        {/* 资源与备份：两个操作合成一张分组卡，与「我的」页菜单卡同构 */}
        <div className="me-menu-card">
          <button type="button" onClick={() => navigate("/me/resources")}>
            <span className="me-menu-icon"><Icon name="book" size={16} /></span>
            <span className="me-menu-copy">
              <b>资源管理</b>
              <small>圣经译本与注释离线下载</small>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
          <button type="button" onClick={exportLocalData}>
            <span className="me-menu-icon"><Icon name="download" size={16} /></span>
            <span className="me-menu-copy">
              <b>{exported ? "已导出本机数据" : "导出本机数据"}</b>
              <small>生成 JSON 备份，不含密码、凭证或社群成员资料</small>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        </div>

        {/* 云端同步：只读状态卡，头部说明 + 数字行，无箭头（点不动就别长得像能点） */}
        <div className="me-menu-card is-static">
          <div className="me-cloud-head">
            <span className="me-menu-icon"><Icon name="cloud" size={16} /></span>
            <span className="me-menu-copy">
              <b>云端同步</b>
              <small>经文高亮和活动报名已关联当前账户</small>
            </span>
          </div>
          <div className="me-cloud-row">
            <span>云端高亮</span>
            <b>{user?.counts.highlights ?? "—"} 处</b>
          </div>
          <div className="me-cloud-row">
            <span>报名活动</span>
            <b>{user?.counts.eventSignups ?? "—"} 项</b>
          </div>
        </div>
      </main>
    </div>
  );
}
