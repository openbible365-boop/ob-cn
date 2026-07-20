import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { db } from "@/lib/db";

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  "1036636088293-gihlhd5hlur5m8btmrr077efq69v95o0.apps.googleusercontent.com";

const googleClient = new OAuth2Client();
const AVATAR_COLORS = ["#FFD465", "#D9C2F0", "#F0C7B7", "#8FB8E8", "#7FD1AE"];

export type GoogleLoginUser = {
  id: string;
  name: string;
  email: string | null;
  avatarColor: string;
  avatarUrl: string | null;
};

export type GoogleLoginResult =
  | { ok: true; message: string; user: GoogleLoginUser }
  | { ok: false; message: string; status: number };

function googleWebClientId() {
  return process.env.GOOGLE_WEB_CLIENT_ID?.trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID;
}

function isGoogleAuthoritativeForEmail(payload: TokenPayload) {
  const email = payload.email?.toLowerCase() ?? "";
  return email.endsWith("@gmail.com") || Boolean(payload.hd);
}

function avatarColorFor(subject: string) {
  const index = [...subject].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function googleAvatarUrl(value: string | undefined) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function loginWithGoogleIdToken(rawIdToken: unknown): Promise<GoogleLoginResult> {
  const idToken = typeof rawIdToken === "string" ? rawIdToken.trim() : "";
  if (!idToken) {
    return { ok: false, message: "Google 登录凭证缺失", status: 400 };
  }

  let payload: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleWebClientId(),
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("[google] ID Token 验证失败：", error);
    return { ok: false, message: "Google 登录凭证无效或已过期，请重新登录", status: 401 };
  }

  const subject = payload?.sub;
  const email = payload?.email?.trim().toLowerCase() || null;
  const avatarUrl = googleAvatarUrl(payload?.picture);
  if (!subject || !email || payload?.email_verified !== true) {
    return { ok: false, message: "Google 账号没有提供已验证的邮箱地址", status: 400 };
  }

  const existingAccount = await db.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: subject,
      },
    },
    include: { user: true },
  });
  let user = existingAccount?.user ?? null;

  if (!user) {
    const sameEmailUser = await db.user.findUnique({ where: { email } });
    if (sameEmailUser) {
      // Gmail and Workspace addresses are authoritative Google identities.
      // For other domains, require the already verified OpenBible email login
      // before adding a future account-linking flow.
      if (!isGoogleAuthoritativeForEmail(payload)) {
        return {
          ok: false,
          message: "该邮箱已有 OpenBible 账号，请先使用邮箱验证码登录后再绑定 Google",
          status: 409,
        };
      }

      await db.authAccount.upsert({
        where: {
          userId_provider: {
            userId: sameEmailUser.id,
            provider: "GOOGLE",
          },
        },
        update: { providerAccountId: subject },
        create: {
          userId: sameEmailUser.id,
          provider: "GOOGLE",
          providerAccountId: subject,
        },
      });
      user = sameEmailUser;
    }
  }

  if (!user) {
    const displayName =
      payload.name?.trim().slice(0, 40) || email.split("@")[0].slice(0, 20) || "Google 用户";
    user = await db.user.create({
      data: {
        name: displayName,
        email,
        avatarColor: avatarColorFor(subject),
        avatarUrl,
        authAccounts: {
          create: [{ provider: "GOOGLE", providerAccountId: subject }],
        },
      },
    });
  }

  if (user.status === "BANNED") {
    return {
      ok: false,
      message: `该账号已被封禁${user.banReason ? `（${user.banReason}）` : ""}，如有疑问请联系运营`,
      status: 403,
    };
  }

  user = await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  });

  return {
    ok: true,
    message: "登录成功",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
    },
  };
}
