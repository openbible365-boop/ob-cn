import { Capacitor, registerPlugin } from "@capacitor/core";

export type AppleSignInResult = {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
};

type AppleSignInPlugin = {
  signIn(): Promise<AppleSignInResult>;
};

const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");

export function signInWithApple() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    throw new Error("Apple 原生登录只能在 iPhone 或 iPad 应用中使用");
  }
  return AppleSignIn.signIn();
}

export function isAppleSignInCanceled(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "APPLE_SIGN_IN_CANCELED"
  );
}
