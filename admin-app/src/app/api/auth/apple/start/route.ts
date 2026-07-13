import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { appleConfigured, appleAuthorizeUrl } from "@/lib/apple";

const OAUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const, // Apple posts the callback cross-site
  path: "/",
  maxAge: 600,
};

export async function GET(request: NextRequest) {
  const base = process.env.APP_URL ?? request.nextUrl.origin;

  if (!appleConfigured()) {
    return NextResponse.redirect(new URL("/me?error=apple_not_configured", base), 303);
  }

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const redirectUri = `${base}/api/auth/apple/callback`;

  const res = NextResponse.redirect(appleAuthorizeUrl({ state, nonce, redirectUri }), 303);
  res.cookies.set("apple_oauth_state", state, OAUTH_COOKIE_OPTS);
  res.cookies.set("apple_oauth_nonce", nonce, OAUTH_COOKIE_OPTS);
  return res;
}
