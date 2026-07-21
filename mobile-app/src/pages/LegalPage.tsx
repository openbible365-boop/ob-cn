import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";

const CONTENT = {
  terms: {
    title: "用户协议",
    sections: [
      ["服务说明", "OpenBible 提供圣经阅读、个人笔记、辅助阅读与社群功能。部分功能仍处于测试阶段，页面会明确标示可用范围。"],
      ["账号与内容", "请妥善保管账号信息，并对自己发布的内容负责。不得发布违法、侵权、仇恨、骚扰或恶意误导内容。"],
      ["辅助解释", "慧读内容仅作为阅读辅助，不替代教会牧养、专业意见或权威释经。"],
      ["服务变更", "功能与规则可能随版本更新调整；涉及付费或重要权益的变更会在启用前另行说明。"],
    ],
  },
  privacy: {
    title: "隐私政策",
    sections: [
      ["收集范围", "账号登录时会处理邮箱及必要的会话信息；本机阅读位置、笔记和通知偏好用于提供对应功能。"],
      ["本机与同步", "未登录时，高亮、笔记和慧读记录主要保存在本机。登录后页面会明确说明哪些数据已同步。"],
      ["权限使用", "通知、图片或系统分享等权限只会在你主动使用相关功能时请求。"],
      ["你的选择", "你可以退出账号、关闭通知偏好，并在相关功能开放后申请导出或删除账号数据。"],
    ],
  },
} as const;

export function LegalPage() {
  const navigate = useNavigate();
  const { type } = useParams();
  const content = type === "privacy" ? CONTENT.privacy : CONTENT.terms;

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" aria-label="返回登录" onClick={() => navigate(-1)}><Icon name="chevron-left" size={18} /></button>
        <div className="title">{content.title}</div>
      </div>
      <main className="screen-scroll legal-page">
        <div className="card legal-card">
          <p className="legal-updated">简明版 · 更新于 2026 年 7 月</p>
          {content.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
