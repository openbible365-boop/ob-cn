"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function createPost(formData: FormData) {
  const user = await requireUser();
  const communityId = String(formData.get("communityId"));
  const content = String(formData.get("content") ?? "").trim();
  const verseRef = String(formData.get("verseRef") ?? "").trim();
  if (!content) throw new Error("内容不能为空");

  const membership = await db.membership.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });
  if (!membership) throw new Error("你不是该社群成员");

  await db.post.create({
    data: {
      communityId,
      authorId: user.id,
      content,
      verseRef: verseRef || null,
    },
  });

  revalidatePath(`/community/${communityId}`);
}

export async function toggleLike(formData: FormData) {
  const user = await requireUser();
  const postId = String(formData.get("postId"));
  const communityId = String(formData.get("communityId"));

  const existing = await db.postLike.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await db.postLike.delete({ where: { id: existing.id } });
    await db.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
  } else {
    await db.postLike.create({ data: { postId, userId: user.id } });
    await db.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
  }

  revalidatePath(`/community/${communityId}`);
}
