import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// End-user site session: a real httpOnly cookie holding the user id.
// There is no registration/password yet — the /me login screen signs the
// visitor in as the seeded test account (王弟兄) — but login/logout state
// itself is real: no cookie means logged out everywhere on the site.
export const SESSION_COOKIE = "ob_session_uid";
export const TEST_USER_NAME = "王弟兄";

export async function getSessionUser() {
  const store = await cookies();
  const uid = store.get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  const user = await db.user.findUnique({ where: { id: uid } });
  if (
    user?.status === "MUTED" &&
    user.mutedUntil &&
    user.mutedUntil.getTime() <= Date.now()
  ) {
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
