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

        <section className="me-data-section">
          <div className="me-data-heading">
            <div>
              <h2>本机数据</h2>
              <p>笔记和慧读仅保存在当前设备。</p>
            </div>
            <span>{notes.length + conversations.length} 条</span>
          </div>
          <div className="me-data-counts">
            <span><b>{highlights.length}</b>高亮</span>
            <span><b>{notes.length}</b>笔记</span>
            <span><b>{conversations.length}</b>慧读</span>
          </div>
          <button className="me-data-export" type="button" onClick={exportLocalData}>
            <Icon name="download" size={16} />
            {exported ? "已导出本机数据" : "导出本机数据"}
          </button>
        </section>

        <section className="me-data-section">
          <div className="me-data-heading">
            <div>
              <h2>云端同步</h2>
              <p>经文高亮和活动报名已关联当前账户。</p>
            </div>
            <Icon name="cloud" size={18} />
          </div>
          <div className="me-data-cloud-row">
            <span>云端高亮</span>
            <b>{user?.counts.highlights ?? "—"} 处</b>
          </div>
          <div className="me-data-cloud-row">
            <span>报名活动</span>
            <b>{user?.counts.eventSignups ?? "—"} 项</b>
          </div>
        </section>

        <p className="me-data-note">
          导出的文件只包含当前设备上的阅读内容，不包含密码、登录凭证或社群成员资料。
        </p>
      </main>
    </div>
  );
}
