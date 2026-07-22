import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/current-user";
import { appleConfigured, exchangeAppleCode, verifyAppleIdToken } from "@/lib/apple";

const AVATAR_COLORS = ["#FFD465", "#D9C2F0", "#F0C7B7", "#8FB8E8", "#7FD1AE"];

function clearOauthCookies(res: NextResponse) {
  res.cookies.delete("apple_oauth_state");
  res.cookies.delete("apple_oauth_nonce");
}

// Apple redirects back via a cross-site form POST (response_mode=form_post).
export async function POST(request: NextRequest) {
  const base = process.env.APP_URL ?? request.nextUrl.origin;
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/me?error=${code}`, base), 303);
    clearOauthCookies(res);
    return res;
  };

  if (!appleConfigured()) return fail("apple_not_configured");

  const form = await request.formData();
  if (form.get("error")) return fail("apple_denied");

  const code = String(form.get("code") ?? "");
  const state = String(form.get("state") ?? "");
  const cookieState = request.cookies.get("apple_oauth_state")?.value;
  const cookieNonce = request.cookies.get("apple_oauth_nonce")?.value;
  if (!code || !state || !cookieState || state !== cookieState) return fail("apple_state");

  let sub: string;
  let email: string | null;
  try {
    const tokens = await exchangeAppleCode(code, `${base}/api/auth/apple/callback`);
    const claims = await verifyAppleIdToken(tokens.id_token, { expectedNonce: cookieNonce });
    sub = claims.sub as string;
    email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  } catch (err) {
    console.error("[apple] 登录验证失败：", err);
    return fail("apple_verify");
  }

  // Apple sends the user's name only on the very first authorization.
  let providedName: string | null = null;
  const rawUser = form.get("user");
  if (typeof rawUser === "string") {
    try {
      const parsed = JSON.parse(rawUser) as { name?: { firstName?: string; lastName?: string } };
      providedName = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ").trim() || null;
    } catch {
      providedName = null;
    }
  }

  // Match order: existing Apple account → existing user with same email
  // (link Apple to it) → register a new user.
  const account = await db.authAccount.findFirst({
    where: { provider: "APPLE", providerAccountId: sub },
    include: { user: true },
  });
  let user = account?.user ?? null;

  if (!user && email) {
    user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.authAccount.upsert({
        where: { userId_provider: { userId: user.id, provider: "APPLE" } },
        update: { providerAccountId: sub },
        create: { userId: user.id, provider: "APPLE", providerAccountId: sub },
      });
    }
  }

  if (!user) {
    const name = providedName ?? (email ? email.split("@")[0].slice(0, 20) : "Apple 用户");
    const color = AVATAR_COLORS[[...sub].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
    user = await db.user.create({
      data: {
        name,
        email: email ?? undefined,
        avatarColor: color,
        authAccounts: { create: [{ provider: "APPLE", providerAccountId: sub }] },
      },
    });
  }

  if (user.status === "BANNED") return fail("apple_banned");

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = NextResponse.redirect(new URL("/me", base), 303);
  clearOauthCookies(res);
  res.cookies.set(SESSION_COOKIE, user.id, { httpOnly: true, path: "/", sameSite: "lax" });
  return res;
}
