import { useState } from "react";
import { apiRequest } from "../data/api";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { Icon } from "../components/Icon";
import { useAppBack } from "../hooks/useAppBack";
import { useSettings } from "../context/SettingsContext";

const FEEDBACK_EMAIL = "mushengbooks@gmail.com";

export function FeedbackPage() {
  const { translate } = useSettings();
  const goBack = useAppBack("/me");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    if (content.trim().length < 5) {
      setError(translate("留言至少写 5 个字"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      // 必须走 apiRequest：原生端 WebView 的相对路径打不到服务器，也带不上会话
      const res = await apiRequest<{ ok?: boolean; message?: string }>("/api/mobile/feedback", {
        method: "POST",
        body: { content: content.trim(), contact: contact.trim() },
      });
      if (res.ok && res.data?.ok) {
        setDone(true);
      } else {
        setError(res.data?.message ?? translate("提交失败，请稍后重试"));
      }
    } catch {
      setError(translate("网络异常，请稍后重试"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader
        ariaLabel={translate("意见反馈")}
        title={translate("意见反馈")}
        subtitle={translate("慧读圣经")}
        onBack={goBack}
      />
      <main className="screen-scroll feedback-page">
        {done ? (
          <section className="card feedback-done" role="status">
            <Icon name="check" size={28} />
            <b>{translate("已收到，感谢你的反馈！")}</b>
            <p>{translate("我们会认真阅读每一条留言。")}</p>
            <button type="button" className="btn-primary" onClick={goBack}>
              {translate("返回")}
            </button>
          </section>
        ) : (
          <form
            className="card feedback-form"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
          >
            <label className="feedback-field">
              <span>{translate("你的留言")}</span>
              <textarea
                value={content}
                maxLength={2000}
                rows={6}
                placeholder={translate("问题、建议或想对我们说的话…")}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <label className="feedback-field">
              <span>{translate("联系方式（选填）")}</span>
              <input
                value={contact}
                maxLength={120}
                placeholder={translate("邮箱或其他联系方式，便于我们回复你")}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
            {error && <div className="feedback-error" role="alert">{error}</div>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {translate(busy ? "提交中…" : "提交留言")}
            </button>
          </form>
        )}

        <p className="feedback-mail">
          {translate("也可以直接写邮件给我们：")}
          <a href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("慧读圣经反馈")}`}>{FEEDBACK_EMAIL}</a>
        </p>
      </main>
    </div>
  );
}
