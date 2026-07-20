import {
  ErrorCode,
  GoogleSignIn,
  type SignInResult,
} from "@capawesome/capacitor-google-sign-in";
import { Capacitor } from "@capacitor/core";

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  "1036636088293-gihld5hlur5m8btmrr077efq69v95o0.apps.googleusercontent.com";

let initializePromise: Promise<void> | null = null;

function webClientId() {
  return import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID;
}

export function initializeGoogleSignIn() {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve();
  }

  initializePromise ??= GoogleSignIn.initialize({
    clientId: webClientId(),
  }).catch((error) => {
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
