"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { generateHuiduBlocks, generateFollowupText } from "@/lib/huidu";

// Starts a 慧读 conversation anchored to a verse (or verse range), persists the
// opening user question + a templated three-part assistant answer, and lands
// the user in the thread view.
export async function startConversation(formData: FormData) {
  const user = await getCurrentUser();
  const book = String(formData.get("book"));
  const chapter = Number(formData.get("chapter"));
  const verseStart = Number(formData.get("verseStart"));
  const verseEnd = Number(formData.get("verseEnd") ?? formData.get("verseStart"));
  const translation = String(formData.get("translation") ?? "和合本");

  const verses = await db.verse.findMany({
    where: { translation, book, chapter, verse: { gte: verseStart, lte: verseEnd } },
    orderBy: { verse: "asc" },
  });
  if (verses.length === 0) throw new Error("找不到对应经文");

  const refLabel = verseStart === verseEnd
    ? `${book} ${chapter}:${verseStart}`
    : `${book} ${chapter}:${verseStart}-${verseEnd}`;
  const verseText = verses.map((v) => v.text).join("");

  const blocks = generateHuiduBlocks(refLabel, verseText);

  const conversation = await db.conversation.create({
    data: {
      userId: user.id,
      translation,
      book,
      chapter,
      verseStart,
      verseEnd,
      verseRefLabel: refLabel,
      verseText,
      title: `${refLabel} 的历史背景与生活应用`,
      messages: {
        create: [
          { role: "USER", content: "请为我解释这节经文" },
          { role: "ASSISTANT", content: "", blocks },
        ],
      },
    },
  });

  redirect(`/huidu/${conversation.id}`);
}

export async function askFollowup(formData: FormData) {
  const user = await getCurrentUser();
  const conversationId = String(formData.get("conversationId"));
  const question = String(formData.get("question") ?? "").trim();
  if (!question) throw new Error("问题不能为空");

  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.userId !== user.id) throw new Error("对话不存在");

  const answer = generateFollowupText(question, conversation.verseRefLabel);

  await db.message.createMany({
    data: [
      { conversationId, role: "USER", content: question },
      { conversationId, role: "ASSISTANT", content: answer },
    ],
  });

  revalidatePath(`/huidu/${conversationId}`);
}
