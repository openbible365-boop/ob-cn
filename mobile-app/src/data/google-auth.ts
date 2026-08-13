import {
  ErrorCode,
  GoogleSignIn,
  type SignInResult,
} from "@capawesome/capacitor-google-sign-in";
import { Capacitor } from "@capacitor/core";

// 开发用的演示 client ID。正式包必须在构建时提供 VITE_GOOGLE_WEB_CLIENT_ID，
// 且要与服务端的 GOOGLE_WEB_CLIENT_ID 一致——服务端按它做 audience 校验，
// 两边不一致时登录会被以 401 拒绝。
const DEV_GOOGLE_WEB_CLIENT_ID =
  "1036636088293-gihlhd5hlur5m8btmrr077efq69v95o0.apps.googleusercontent.com";

let initializePromise: Promise<void> | null = null;

function webClientId() {
  const configured = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim();
  if (configured) return configured;
  // 正式包不回落到演示凭据：宁可初始化失败被发现，也不要用别人项目的凭据放行登录
  if (import.meta.env.PROD) return "";
  return DEV_GOOGLE_WEB_CLIENT_ID;
}

export function initializeGoogleSignIn() {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve();
  }

  const clientId = webClientId();
  if (!clientId) {
    return Promise.reject(
      new Error("未配置 Google 登录（VITE_GOOGLE_WEB_CLIENT_ID），请使用邮箱验证码登录"),
    );
  }

  initializePromise ??= GoogleSignIn.initialize({ clientId }).catch((error) => {
    initializePromise = null;
    throw error;
  });
  return initializePromise;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Google 原生登录请在 Android 或 iPhone 应用中测试");
  }
  await initializeGoogleSignIn();
  return GoogleSignIn.signIn();
}

export function isGoogleSignInCanceled(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (error as { code?: unknown }).code === ErrorCode.SignInCanceled;
}

export async function clearGoogleCredentialState() {
  if (!Capacitor.isNativePlatform()) return;
  await initializeGoogleSignIn();
  await GoogleSignIn.signOut();
}
