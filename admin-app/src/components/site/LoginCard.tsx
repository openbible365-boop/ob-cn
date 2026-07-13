"use client";

import { useActionState, useState } from "react";
import { sendLoginCode, verifyLoginCode, type AuthFormState } from "@/lib/actions/site/email-auth";
import { loginAsTestUser } from "@/lib/actions/site/me";

// Email + verification-code login/registration (mirrors the mobile 5d
// design). 获取验证码 and 登录/注册 are two server actions sharing one form:
// the send button uses formAction so the typed email is reused. Inputs are
// controlled so React's post-action form reset doesn't wipe them.
export function LoginCard({
  appleEnabled = false,
  initialError,
}: {
  appleEnabled?: boolean;
  initialError?: string;
}) {
  const [sendState, sendAction, sendPending] = useActionState<AuthFormState, FormData>(sendLoginCode, null);
  const [verifyState, verifyAction, verifyPending] = useActionState<AuthFormState, FormData>(verifyLoginCode, null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const notice = verifyState ?? sendState ?? (initialError ? { ok: false, message: initialError } : null);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 24px" }}>
      <div className="card" style={{ width: 400, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--yellow)", borderRadius: 16 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#18191F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>OpenBible</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--body)" }}>登录后，高亮、笔记与慧读历史将全端同步</div>
        </div>

        <form action={verifyAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            name="email"
            type="email"
            required
            placeholder="输入 email 地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ height: 48, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="输入 6 位验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ flex: 1, height: 48, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500 }}
            />
            <button
              type="submit"
              formAction={sendAction}
              formNoValidate
              disabled={sendPending}
              style={{ height: 48, padding: "0 14px", background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: sendPending ? 0.6 : 1 }}
            >
              {sendPending ? "发送中…" : "获取验证码"}
            </button>
          </div>

          {notice && (
            <div
              style={{
                fontSize: 12, fontWeight: 700, borderRadius: 12, padding: "10px 12px", lineHeight: 1.6,
                color: notice.ok ? "var(--ink)" : "var(--pink)",
                background: notice.ok ? "rgba(191,120,246,.12)" : "rgba(225,49,125,.1)",
              }}
            >
              {notice.message}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={verifyPending} style={{ opacity: verifyPending ? 0.6 : 1 }}>
            {verifyPending ? "验证中…" : "登录 / 注册"}
          </button>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)", textAlign: "center" }}>
            首次使用同一邮箱登录将自动注册
          </div>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--surface-2)" }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>或使用以下方式登录</div>
          <div style={{ flex: 1, height: 1, background: "var(--surface-2)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {appleEnabled ? (
            // OAuth 必须整页跳转到 API 路由（Link 预取会误发起授权流程）
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              href="/api/auth/apple/start"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46, background: "var(--ink)", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16.36 12.76c.03 3.26 2.86 4.35 2.89 4.36-.02.08-.45 1.55-1.49 3.07-.9 1.31-1.83 2.62-3.3 2.65-1.44.03-1.91-.86-3.56-.86-1.65 0-2.17.83-3.53.89-1.42.05-2.5-1.42-3.4-2.73-1.86-2.68-3.28-7.56-1.37-10.86.95-1.64 2.64-2.68 4.48-2.7 1.39-.03 2.71.94 3.56 .94.85 0 2.45-1.17 4.13-1 .7.03 2.68.28 3.94 2.14-.1.06-2.35 1.38-2.35 4.1zM13.6 4.34c.75-.91 1.26-2.18 1.12-3.44-1.08.04-2.39.72-3.17 1.63-.7.81-1.31 2.1-1.14 3.34 1.2.09 2.44-.62 3.19-1.53z" />
              </svg>
              Sign in with Apple
            </a>
          ) : (
            <button type="button" title="未配置 Apple 登录（需 Apple 开发者账号，见 .env.example）" style={{ height: 46, background: "var(--ink)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "default", opacity: 0.6 }}>Sign in with Apple</button>
          )}
          <button type="button" title="即将上线" style={{ height: 46, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "default", opacity: 0.6 }}>使用 Google 登录</button>
        </div>

        <form action={loginAsTestUser} style={{ textAlign: "center" }}>
          <button type="submit" style={{ background: "none", border: "none", fontSize: 11, fontWeight: 700, color: "var(--purple)", cursor: "pointer" }}>
            演示：以测试账号「王弟兄」快捷登录
          </button>
        </form>

        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--body)", textAlign: "center", lineHeight: 1.7 }}>登录即代表同意《用户协议》与《隐私政策》</div>
      </div>
    </div>
  );
}
