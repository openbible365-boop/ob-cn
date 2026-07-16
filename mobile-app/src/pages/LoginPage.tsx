import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { sendLoginCode, verifyLoginCode } from "../data/profile";
import { syncHighlights } from "../data/annotations";

// 注册登录（design 5d）— real email verification-code login against the
// OpenBible backend; first login auto-registers the account.
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    const timer = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) clearInterval(timer);
        return s - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    const result = await sendLoginCode(email);
    setBusy(false);
    if (result.ok) {
      setNotice(result.message);
      startCooldown(60);
    } else {
      setError(result.message);
    }
  };

  const submit = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("请输入 6 位数字验证码");
      return;
    }
    setError("");
    setBusy(true);
    const result = await verifyLoginCode(email, code.trim());
    if (result.ok) {
      await syncHighlights();
      setBusy(false);
      navigate("/me", { replace: true });
    } else {
      setBusy(false);
      setError(result.message);
    }
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
                placeholder="6 位验证码"
                inputMode="numeric"
                maxLength={6}
                style={{ flex: 1, height: "100%", fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent", minWidth: 0 }}
              />
            </div>
            <button
              onClick={sendCode}
              disabled={busy || cooldown > 0}
              style={{ flex: "none", height: 48, padding: "0 14px", background: cooldown > 0 ? "var(--surface-2)" : "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 13, fontWeight: 700, color: cooldown > 0 ? "var(--body)" : "var(--ink)" }}
            >
              {cooldown > 0 ? `${cooldown}s` : "获取验证码"}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pink)" }}>{error}</div>}
          {notice && !error && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)", lineHeight: 1.6 }}>{notice}</div>
          )}
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "请稍候…" : "登录 / 注册"}
          </button>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)", textAlign: "center" }}>首次使用同一邮箱登录将自动注册</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)" }}>或</div>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <button
          onClick={() => { setError("移动端 Apple 登录即将开放，网页版已支持"); }}
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 50, fontSize: 14, fontWeight: 700 }}
        >
           通过 Apple 登录
        </button>

        <div className="disclaimer">登录即表示同意《用户协议》与《隐私政策》</div>
      </div>
    </div>
  );
}
