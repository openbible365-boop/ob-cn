"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function createEvent(formData: FormData) {
  const user = await getCurrentUser();
  const communityId = String(formData.get("communityId"));
  const title = String(formData.get("title") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "");
  const endAt = String(formData.get("endAt") ?? "");
  if (!title) throw new Error("活动名称不能为空");
  if (!startAt) throw new Error("开始时间不能为空");

  const membership = await db.membership.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("只有群主或管理员可以新建活动");
  }

  await db.event.create({
    data: {
      communityId,
      title,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
    },
  });

  revalidatePath(`/community/${communityId}/events`);
}

export async function toggleSignup(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = String(formData.get("eventId"));
  const communityId = String(formData.get("communityId"));

  const existing = await db.eventSignup.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  });

  if (existing) {
    await db.eventSignup.delete({ where: { id: existing.id } });
    await db.event.update({ where: { id: eventId }, data: { signupCount: { decrement: 1 } } });
  } else {
    await db.eventSignup.create({ data: { eventId, userId: user.id } });
    await db.event.update({ where: { id: eventId }, data: { signupCount: { increment: 1 } } });
  }

  revalidatePath(`/community/${communityId}/events`);
}
