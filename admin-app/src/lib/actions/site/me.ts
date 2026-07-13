"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { SESSION_COOKIE, TEST_USER_NAME, requireUser } from "@/lib/current-user";
import { defaultFor, NOTIFICATION_PREFS } from "@/lib/notification-prefs";

// Demo login: no registration exists yet, so this signs the visitor in as
// the seeded test account. The session cookie itself is real — logout
// removes it and the whole site reflects the logged-out state.
export async function loginAsTestUser() {
  const user = await db.user.findFirstOrThrow({ where: { name: TEST_USER_NAME } });
  const store = await cookies();
  store.set(SESSION_COOKIE, user.id, { httpOnly: true, path: "/", sameSite: "lax" });
  redirect("/me");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/me");
}

export async function toggleNotification(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("key"));
  if (!NOTIFICATION_PREFS.some((p) => p.key === key)) throw new Error("未知的通知项");

  const existing = await db.notificationSetting.findUnique({
    where: { userId_key: { userId: user.id, key } },
  });
  const next = existing ? !existing.enabled : !defaultFor(key);

  await db.notificationSetting.upsert({
    where: { userId_key: { userId: user.id, key } },
    update: { enabled: next },
    create: { userId: user.id, key, enabled: next },
  });

  revalidatePath("/me/notifications");
}
