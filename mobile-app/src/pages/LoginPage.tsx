import { useEffect, useRef, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { Capacitor } from "@capacitor/core";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { SHOW_COMMUNITY } from "../data/features";
import { sendLoginCode, syncPersonalData, verifyAppleLogin, verifyGoogleLogin, verifyLoginCode, verifyPasswordLogin } from "../data/profile";
import { syncStoredPushToken } from "../data/push";
import { pullReadingPosition } from "../data/reading-sync";
import { isGoogleSignInCanceled, signInWithGoogle } from "../data/google-auth";
import { isAppleSignInCanceled, signInWithApple } from "../data/apple-auth";
import { useSettings } from "../context/SettingsContext";

// 注册登录（design 5d）— real email verification-code login against the
// OpenBible backend; first login auto-registers the account.
// 另有「密码登录」：仅限后台开通了密码的账号（商店审核 / 内部测试），不能用于注册。
type LoginMode = "code" | "password";

export function LoginPage() {
  const { isEnglish, translate } = useSettings();
  const navigate = useNavigate();
  const goBack = useAppBack("/me");
  const location = useLocation();
  const isAndroid = Capacitor.getPlatform() === "android" || /Android/i.test(navigator.userAgent);
  const isNative = Capacitor.isNativePlatform();
  const showAppleLogin = !isAndroid;
  const returnTo = ((location.state as { from?: string } | null)?.from) || "/me";
  // 登录成功跳回原页面时一并带回的路由状态（如「登录后继续慧读」要恢复的经节）
  const returnState = (location.state as { fromState?: unknown } | null)?.fromState;
  const [mode, setMode] = useState<LoginMode>("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  // 倒计时句柄记在 ref 里，组件卸载时清掉，避免离开页面后定时器空转
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
  }, []);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1 && cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        return s - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(translate("请输入有效的邮箱地址"));
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
    if (mode === "password") {
      await submitPassword();
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError(translate("请输入 6 位数字验证码"));
      return;
    }
    setError("");
    setBusy(true);
    const result = await verifyLoginCode(email, code.trim());
    if (result.ok) {
      await syncPersonalData(); // 取回账号里的高亮、笔记、慧读记录，并上传本机未登录时的记录
      void syncStoredPushToken(); // 把本机推送 token 绑到刚登录的账号
      void pullReadingPosition(); // 取回其他设备的阅读位置
      setBusy(false);
      navigate(returnTo, { replace: true, state: returnState });
    } else {
      setBusy(false);
      setError(result.message);
    }
  };

  const submitPassword = async () => {
    if (!account.trim() || !password) {
      setError(translate("请输入账号和密码"));
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    const result = await verifyPasswordLogin(account.trim(), password);
    if (result.ok) {
      await syncPersonalData(); // 取回账号里的高亮、笔记、慧读记录，并上传本机未登录时的记录
      void syncStoredPushToken(); // 把本机推送 token 绑到刚登录的账号
      void pullReadingPosition(); // 取回其他设备的阅读位置
      setBusy(false);
      navigate(returnTo, { replace: true, state: returnState });
    } else {
      setBusy(false);
      setError(result.message);
    }
  };

  const switchMode = (next: LoginMode) => {
    if (next === mode) return;
    setMode(next);
    setError("");
    setNotice("");
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
      await syncPersonalData(); // 取回账号里的高亮、笔记、慧读记录，并上传本机未登录时的记录
      void syncStoredPushToken(); // 把本机推送 token 绑到刚登录的账号
      void pullReadingPosition(); // 取回其他设备的阅读位置
      navigate(returnTo, { replace: true, state: returnState });
    } catch (error) {
      if (!isGoogleSignInCanceled(error)) {
        const message = error instanceof Error ? error.message : translate("Google 登录失败，请稍后重试");
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
      await syncPersonalData(); // 取回账号里的高亮、笔记、慧读记录，并上传本机未登录时的记录
      void syncStoredPushToken(); // 把本机推送 token 绑到刚登录的账号
      void pullReadingPosition(); // 取回其他设备的阅读位置
      // 与邮箱/Google 登录一致：回到被登录墙拦下前的目标页，而不是写死「我的」
      navigate(returnTo, { replace: true, state: returnState });
    } catch (error) {
      if (!isAppleSignInCanceled(error)) {
        const message = error instanceof Error ? error.message : translate("Apple 登录失败，请稍后重试");
        setError(message);
      }
    } finally {
      setAppleBusy(false);
    }
  };

  return (
    <div className="screen login-screen">
      <UnifiedHeader
        title={translate("登录 / 注册")}
        subtitle="OpenBible"
        ariaLabel={translate("账号登录")}
        onBack={goBack}
        backLabel={translate("返回我的")}
      />

      <div className="screen-scroll login-scroll">
        <div className="login-hero">
          <div className="login-logo" aria-label="OpenBible">
            <svg
              viewBox="22 5 76 88"
              xmlns="http://www.w3.org/2000/svg"
              width="56"
              height="56"
              role="img"
              aria-hidden="true"
            >
              <polygon points="60,9 63.2,15.8 72,19 63.2,22.2 60,31 56.8,22.2 48,19 56.8,15.8" fill="#E89A2C" />
              <polygon points="43.6,25.6 45.5,30.1 50,32 45.5,33.9 43.6,38.4 41.7,33.9 37.2,32 41.7,30.1" fill="currentColor" />
              <polygon points="77.9,23.6 79.8,28.1 84.3,30 79.8,31.9 77.9,36.4 76,31.9 71.5,30 76,28.1" fill="currentColor" />
              <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
              <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
              <line x1="60" y1="53" x2="60" y2="88" stroke="currentColor" strokeWidth="5" />
            </svg>
          </div>
          <div className="login-title">
            {isEnglish ? (
              <>
                <span className="login-title-brand">Open</span>
                <span>Bible</span>
              </>
            ) : (
              <>
                <span className="login-title-brand">慧读</span>
                <span>圣经</span>
              </>
            )}
          </div>
          <div className="login-slogan">
            {isEnglish
              ? "Wisdom · Scripture · Fellowship"
              : SHOW_COMMUNITY ? "智慧 · 读经 · 社群 · 共勉" : "智慧 · 读经 · 共勉"}
          </div>
        </div>

        {/* 包成真正的 form：手机键盘的「前往/回车」可以直接提交 */}
        <form
          className="card login-card"
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <div className="login-mode-tabs" role="tablist" aria-label={translate("登录方式")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "code"}
              className={mode === "code" ? "active" : ""}
              onClick={() => switchMode("code")}
            >
              {translate("验证码登录")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "password"}
              className={mode === "password" ? "active" : ""}
              onClick={() => switchMode("password")}
            >
              {translate("密码登录")}
            </button>
          </div>

          {mode === "code" ? (
            <>
              <label className="login-field">
                <Icon name="mail" size={16} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={translate("邮箱地址")}
                  aria-label={translate("邮箱地址")}
                  type="email"
                />
              </label>
              <div className="login-code-row">
                <label className="login-field">
                  <Icon name="lock" size={16} />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={translate("6 位验证码")}
                    aria-label={translate("6 位验证码")}
                    inputMode="numeric"
                    maxLength={6}
                  />
                </label>
                <button type="button" className="login-send-btn" onClick={sendCode} disabled={busy || cooldown > 0}>
                  {cooldown > 0 ? `${cooldown}s` : translate("获取验证码")}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="login-field">
                <Icon name="user" size={16} />
                <input
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder={translate("用户名或邮箱")}
                  aria-label={translate("用户名或邮箱")}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={120}
                />
              </label>
              <label className="login-field">
                <Icon name="lock" size={16} />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={translate("密码")}
                  aria-label={translate("密码")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={128}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={translate(showPassword ? "隐藏密码" : "显示密码")}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <Icon name="eye" size={16} />
                </button>
              </label>
            </>
          )}
          {error && <div role="alert" className="login-feedback is-error">{error}</div>}
          {notice && !error && <div role="status" className="login-feedback">{notice}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? translate("请稍候…") : translate(mode === "code" ? "登录 / 注册" : "登录")}
          </button>
          <div className="login-hint">
            {translate(mode === "code" ? "首次使用同一邮箱登录将自动注册" : "密码登录仅限已开通密码的账号")}
          </div>
        </form>

        <div className="login-divider" aria-hidden="true"><i /><span>{translate("或")}</span><i /></div>

        <div className="login-oauth">
          {showAppleLogin && (
            <button type="button" className="card login-oauth-btn" onClick={signInWithAppleAccount} disabled={busy || appleBusy}>
              {translate(appleBusy ? "正在连接 Apple…" : "通过 Apple 登录")}
            </button>
          )}
          <button type="button" className="card login-oauth-btn" onClick={signInWithGoogleAccount} disabled={!isNative || busy || googleBusy}>
            {translate(googleBusy ? "正在连接 Google…" : isNative ? "使用 Google 登录" : "Google 登录 · 请在 App 使用")}
          </button>
        </div>

        <div className="disclaimer">
          {isEnglish ? (
            <>
              By signing in, you agree to the&nbsp;
              <button type="button" className="text-link" onClick={() => navigate("/legal/terms")}>{translate("用户协议")}</button>
              &nbsp;and&nbsp;
              <button type="button" className="text-link" onClick={() => navigate("/legal/privacy")}>{translate("隐私政策")}</button>.
            </>
          ) : (
            <>
              登录即表示同意
              <button type="button" className="text-link" onClick={() => navigate("/legal/terms")}>《{translate("用户协议")}》</button>
              与
              <button type="button" className="text-link" onClick={() => navigate("/legal/privacy")}>《{translate("隐私政策")}》</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
