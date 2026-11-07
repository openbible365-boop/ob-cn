"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

// 删除一条慧读对话（含全部消息）。对话属于用户隐私，只有超级管理员可操作，并写入审计。
export async function deleteConversation(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const conversationId = String(formData.get("conversationId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!conversationId) return;

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { user: { select: { name: true, uid: true } } },
  });
  if (!conversation) return;

  await db.conversation.delete({ where: { id: conversationId } });
  await logAudit({
    operatorId: session.user.id,
    action: "删除慧读对话",
    targetType: "Conversation",
    targetId: conversation.id,
    detail: `用户 ${conversation.user.name}（UID ${conversation.user.uid}）· ${conversation.title.slice(0, 40)}`,
  });

  revalidatePath("/admin/ai-records");
  if (returnTo === "list") redirect("/admin/ai-records");
}
