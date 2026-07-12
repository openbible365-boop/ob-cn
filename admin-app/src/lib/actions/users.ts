"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireOperator() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function muteUser(formData: FormData) {
  await requireOperator();
  const userId = String(formData.get("userId"));
  const mutedUntil = new Date();
  mutedUntil.setDate(mutedUntil.getDate() + 7);

  await db.user.update({
    where: { id: userId },
    data: { status: "MUTED", mutedUntil },
  });

  revalidatePath("/users");
}

export async function banUser(formData: FormData) {
  await requireOperator();
  const userId = String(formData.get("userId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("封禁需要填写原因");

  await db.user.update({
    where: { id: userId },
    data: { status: "BANNED", banReason: reason },
  });

  revalidatePath("/users");
}

export async function unbanUser(formData: FormData) {
  await requireOperator();
  const userId = String(formData.get("userId"));

  await db.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", banReason: null, mutedUntil: null },
  });

  revalidatePath("/users");
}
