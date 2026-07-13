import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { setLoggedIn } from "../data/profile";

// 注册登录（design 5d）— UI matches the design; this build keeps a
// device-local session. Real email-code / Apple login arrives with the
// backend API integration.
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const sendCode = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    setError("");
    setSent(true);
  };

  const submit = () => {
    if (!sent) {
      setError("请先获取验证码");
      return;
    }
    if (code.trim().length < 4) {
      setError("请输入验证码（演示版任意 4 位以上）");
      return;
    }
    setLoggedIn(true);
    navigate("/me", { replace: true });
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <div className="page-header">
        <button className="icon-btn" onClick={() => navigate("/me")}><Icon name="chevron-left" size={18} /></button>
        <div className="title">登录 / 注册</div>
      </div>

      <div className="screen-scroll" style={{ padding: "26px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
            <Icon name="book" size={28} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>OpenBible</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>读经 · 慧读 · 社群共读</div>
        </div>

        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "0 14px", height: 48 }}>
            <Icon name="mail" size={16} />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱地址"
              type="email"
              style={{ flex: 1, height: "100%", fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "0 14px", height: 48 }}>
              <Icon name="lock" size={16} />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="验证码"
                inputMode="numeric"
                style={{ flex: 1, height: "100%", fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent", minWidth: 0 }}
              />
            </div>
            <button
              onClick={sendCode}
              disabled={sent}
              style={{ flex: "none", height: 48, padding: "0 14px", background: sent ? "var(--surface-2)" : "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 13, fontWeight: 700, color: sent ? "var(--body)" : "var(--ink)" }}
            >
              {sent ? "已发送" : "获取验证码"}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pink)" }}>{error}</div>}
          {sent && !error && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>
              演示版未真实发信：输入任意 4 位以上验证码即可登录。
            </div>
          )}
          <button className="btn-primary" onClick={submit}>登录 / 注册</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>或</div>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <button
          onClick={() => { setError("Apple 登录将在接入账号服务后开放"); }}
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 50, fontSize: 14, fontWeight: 700 }}
        >
           通过 Apple 登录
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,212,101,.35)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
          <Icon name="cloud" size={15} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>
            此版本登录状态仅保存在本机。接入 OpenBible 账号服务（邮箱验证码 / Apple）后自动升级为真实账号。
          </div>
        </div>

        <div className="disclaimer">登录即表示同意《用户协议》与《隐私政策》</div>
      </div>
    </div>
  );
}
