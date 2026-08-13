import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  appleIosClientId,
  appleNativeConfigured,
  exchangeAppleNativeCode,
  verifyAppleIdToken,
} from "@/lib/apple";

const AVATAR_COLORS = ["#FFD465", "#D9C2F0", "#F0C7B7", "#8FB8E8", "#7FD1AE"];

export type AppleLoginUser = {
  id: string;
  name: string;
  email: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  tier: "BASIC_FREE" | "MID" | "HIGH";
  tierPriceCents: number;
};

export type AppleLoginResult =
  | { ok: true; message: string; user: AppleLoginUser }
  | { ok: false; message: string; status: number };

type NativeAppleCredential = {
  identityToken?: unknown;
  authorizationCode?: unknown;
  nonce?: unknown;
  givenName?: unknown;
  familyName?: unknown;
};

function stringValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function claimIsTrue(value: unknown) {
  return value === true || value === "true";
}

function avatarColorFor(subject: string) {
  const index = [...subject].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export async function loginWithNativeAppleCredential(
  credential: NativeAppleCredential,
): Promise<AppleLoginResult> {
  if (!appleNativeConfigured()) {
    return { ok: false, message: "Apple 登录服务尚未配置完成", status: 503 };
  }

  const identityToken = stringValue(credential.identityToken, 16_384);
  const authorizationCode = stringValue(credential.authorizationCode, 4_096);
  const rawNonce = stringValue(credential.nonce, 256);
  if (!identityToken || !authorizationCode || !rawNonce) {
    return { ok: false, message: "Apple 登录凭证不完整，请重新登录", status: 400 };
  }

  const nonceHash = createHash("sha256").update(rawNonce).digest("hex");
  let subject: string;
  let email: string | null;
  try {
    const claims = await verifyAppleIdToken(identityToken, {
      audience: appleIosClientId(),
      expectedNonce: nonceHash,
    });
    subject = claims.sub as string;
    email =
      typeof claims.email === "string" && claimIsTrue(claims.email_verified)
        ? claims.email.trim().toLowerCase()
        : null;

    // Redeeming the one-time authorization code proves this credential was
    // issued to our native app, while the separately supplied identity token
    // is nonce-bound to this exact login attempt.
    const exchanged = await exchangeAppleNativeCode(authorizationCode);
    const exchangedClaims = await verifyAppleIdToken(exchanged.id_token, {
      audience: appleIosClientId(),
    });
    if (exchangedClaims.sub !== subject) {
      throw new Error("Apple token subjects do not match");
    }
  } catch (error) {
    console.error("[apple-native] 登录凭证验证失败：", error);
    return { ok: false, message: "Apple 登录凭证无效或已过期，请重新登录", status: 401 };
  }

  const existingAccount = await db.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "APPLE",
        providerAccountId: subject,
      },
    },
    include: { user: true },
  });
  let user = existingAccount?.user ?? null;

  if (!user && email) {
    const sameEmailUser = await db.user.findUnique({ where: { email } });
    if (sameEmailUser) {
      await db.authAccount.upsert({
        where: {
          userId_provider: {
            userId: sameEmailUser.id,
            provider: "APPLE",
          },
        },
        update: { providerAccountId: subject },
        create: {
          userId: sameEmailUser.id,
          provider: "APPLE",
          providerAccountId: subject,
        },
      });
      user = sameEmailUser;
    }
  }

  if (!user) {
    const givenName = stringValue(credential.givenName, 40);
    const familyName = stringValue(credential.familyName, 40);
    const displayName =
      [familyName, givenName].filter(Boolean).join("").slice(0, 40) ||
      email?.split("@")[0].slice(0, 20) ||
      "Apple 用户";
    user = await db.user.create({
      data: {
        name: displayName,
        email: email ?? undefined,
        avatarColor: avatarColorFor(subject),
        authAccounts: {
          create: [{ provider: "APPLE", providerAccountId: subject }],
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
    data: { lastLoginAt: new Date() },
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
      tier: user.tier,
      tierPriceCents: user.tierPriceCents,
    },
  };
}
