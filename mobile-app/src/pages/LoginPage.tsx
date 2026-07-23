import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { sendLoginCode, verifyAppleLogin, verifyGoogleLogin, verifyLoginCode } from "../data/profile";
import { syncHighlights } from "../data/annotations";
import { isGoogleSignInCanceled, signInWithGoogle } from "../data/google-auth";
import { isAppleSignInCanceled, signInWithApple } from "../data/apple-auth";

// 注册登录（design 5d）— real email verification-code login against the
// OpenBible backend; first login auto-registers the account.
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAndroid = Capacitor.getPlatform() === "android" || /Android/i.test(navigator.userAgent);
  const isNative = Capacitor.isNativePlatform();
  const showAppleLogin = !isAndroid;
  const returnTo = ((location.state as { from?: string } | null)?.from) || "/me";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

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
      navigate(returnTo, { replace: true });
    } else {
      setBusy(false);
      setError(result.message);
    }
  };

  const signInWithGoogleAccount = async () => {
    setError("");
    setNotice("");
    setGoogleBusy(true);
    try {
      const googleResult = await signInWithGoogle();
      const result = await verifyGoogleLogin(googleResult.idToken);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await syncHighlights();
      navigate(returnTo, { replace: true });
    } catch (error) {
      if (!isGoogleSignInCanceled(error)) {
        const message = error instanceof Error ? error.message : "Google 登录失败，请稍后重试";
        setError(message);
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const signInWithAppleAccount = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.location.assign("/api/auth/apple/start");
      return;
    }

    setError("");
    setNotice("");
    setAppleBusy(true);
    try {
      const appleResult = await signInWithApple();
      const result = await verifyAppleLogin({
        identityToken: appleResult.identityToken,
        authorizationCode: appleResult.authorizationCode,
        nonce: appleResult.nonce,
        givenName: appleResult.givenName,
        familyName: appleResult.familyName,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await syncHighlights();
      navigate("/me", { replace: true });
    } catch (error) {
      if (!isAppleSignInCanceled(error)) {
        const message = error instanceof Error ? error.message : "Apple 登录失败，请稍后重试";
        setError(message);
      }
    } finally {
      setAppleBusy(false);
    }
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader title="登录 / 注册" subtitle="OpenBible" ariaLabel="账号登录" onBack={() => navigate("/me")} backLabel="返回我的" />

      <div className="screen-scroll" style={{ padding: "26px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 78,
              height: 78,
              color: "var(--ink)",
            }}
            aria-label="OpenBible"
          >
            <svg
              viewBox="16 8 88 88"
              xmlns="http://www.w3.org/2000/svg"
              width="78"
              height="78"
              role="img"
              aria-hidden="true"
              style={{ overflow: "visible" }}
            >
              <polygon points="60,9 63.2,15.8 72,19 63.2,22.2 60,31 56.8,22.2 48,19 56.8,15.8" fill="#E89A2C" />
              <polygon points="43.6,25.6 45.5,30.1 50,32 45.5,33.9 43.6,38.4 41.7,33.9 37.2,32 41.7,30.1" fill="currentColor" />
              <polygon points="77.9,23.6 79.8,28.1 84.3,30 79.8,31.9 77.9,36.4 76,31.9 71.5,30 76,28.1" fill="currentColor" />
              <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
              <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
              <line x1="60" y1="53" x2="60" y2="88" stroke="currentColor" strokeWidth="4" />
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            <span style={{ color: "#E89A2C" }}>慧读</span>
            <span>圣经</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>智慧 · 读经 · 社群 · 共勉</div>
        </div>

        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "0 14px", height: 48 }}>
            <Icon name="mail" size={16} />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱地址"
              type="email"
              style={{ flex: 1, minWidth: 0, height: "100%", fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "0 14px", height: 48 }}>
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
              style={{ height: 48, padding: "0 14px", whiteSpace: "nowrap", background: cooldown > 0 ? "var(--surface-2)" : "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", fontSize: 13, fontWeight: 700, color: cooldown > 0 ? "var(--body)" : "var(--ink)" }}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {showAppleLogin && (
            <button
              type="button"
              onClick={signInWithAppleAccount}
              disabled={busy || appleBusy}
              className="card"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 50, fontSize: 14, fontWeight: 700, opacity: busy || appleBusy ? 0.65 : 1 }}
            >
              {appleBusy ? "正在连接 Apple…" : "通过 Apple 登录"}
            </button>
          )}
          <button
            type="button"
            onClick={signInWithGoogleAccount}
            disabled={!isNative || busy || googleBusy}
            className="card"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 50, fontSize: 14, fontWeight: 700, color: "var(--body)", opacity: !isNative || busy || googleBusy ? 0.58 : 1, cursor: !isNative ? "not-allowed" : "pointer" }}
          >
            {googleBusy ? "正在连接 Google…" : isNative ? "使用 Google 登录" : "Google 登录 · 请在 App 使用"}
          </button>
        </div>

        <div className="disclaimer">
          登录即表示同意
          <button type="button" className="text-link" onClick={() => navigate("/legal/terms")}>《用户协议》</button>
          与
          <button type="button" className="text-link" onClick={() => navigate("/legal/privacy")}>《隐私政策》</button>
        </div>
      </div>
    </div>
  );
}
