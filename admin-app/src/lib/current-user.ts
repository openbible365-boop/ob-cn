import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// 终端用户会话。
//
// Cookie 里放的是不可猜测的随机 token，服务端只保存它的 SHA-256。
// 早期版本 cookie 直接存明文 user id，而社群接口会把作者的 user id 返回给前端
// ——任何人拿到他人 id 手动改 cookie 即可冒充该账号。改成随机 token 后，
// 猜中的概率相当于猜中 32 字节随机数，且数据库泄露也无法反推出可用的 cookie。
export const SESSION_COOKIE = "ob_session";
export const TEST_USER_NAME = "王弟兄";

/** 会话有效期：30 天；每次访问滑动续期（见 getSessionUser）。 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 距上次续期超过这个间隔才写库，避免每个请求都产生一次写操作。 */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    // 生产走 HTTPS，避免 cookie 在明文信道上被截获
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  };
}

/**
 * 只签发会话记录、返回原始 token，不碰 cookie。
 * 供需要把 cookie 写在自己的 Response 上的调用方使用（如 OAuth 回调的 302）。
 * 原始 token 不落库，库里只有它的哈希。
 */
export async function issueSessionToken(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
  });
  return { token, expiresAt, cookieOptions: cookieOptions(expiresAt) };
}

/** 登录成功后调用：签发新会话并种下 cookie。 */
export async function createSession(userId: string, userAgent?: string | null) {
  const issued = await issueSessionToken(userId, userAgent);
  const store = await cookies();
  store.set(SESSION_COOKIE, issued.token, issued.cookieOptions);
  return issued;
}

/** 退出登录：删除服务端会话记录并清 cookie（仅撤销当前这一个设备）。 */
export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    // deleteMany 而非 delete：token 已失效时不抛错
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  // 过期即清理，避免过期记录长期堆积
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // 滑动续期：活跃用户不会用着用着被登出，但每天最多写一次
  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => {});
  }

  const user = session.user;
  if (user.status === "MUTED" && user.mutedUntil && user.mutedUntil.getTime() <= Date.now()) {
    return db.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", mutedUntil: null },
    });
  }
  return user;
}

// For pages/actions that only make sense with an identity — bounce to the
// /me login screen when logged out.
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/me");
  return user;
}
