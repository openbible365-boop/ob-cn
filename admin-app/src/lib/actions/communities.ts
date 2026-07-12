"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireOperator() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function warnCommunity(formData: FormData) {
  await requireOperator();
  const communityId = String(formData.get("communityId"));

  await db.community.update({
    where: { id: communityId },
    data: { warningCount: { increment: 1 } },
  });

  revalidatePath("/communities");
}

export async function banCommunity(formData: FormData) {
  await requireOperator();
  const communityId = String(formData.get("communityId"));

  await db.community.update({
    where: { id: communityId },
    data: { status: "BANNED" },
  });

  revalidatePath("/communities");
}

export async function unbanCommunity(formData: FormData) {
  await requireOperator();
  const communityId = String(formData.get("communityId"));

  await db.community.update({
    where: { id: communityId },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/communities");
}

export async function dissolveCommunity(formData: FormData) {
  await requireOperator();
  const communityId = String(formData.get("communityId"));

  await db.community.update({
    where: { id: communityId },
    data: { status: "DISSOLVED" },
  });

  revalidatePath("/communities");
}
