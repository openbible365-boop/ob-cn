import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type MessageInput = {
  role?: unknown;
  content?: unknown;
  blocks?: unknown;
  sources?: unknown;
};

type ConversationInput = {
  id?: unknown;
  kind?: unknown;
  bookCode?: unknown;
  versionCode?: unknown;
  chapter?: unknown;
  verse?: unknown;
  refLabel?: unknown;
  verseText?: unknown;
  title?: unknown;
  createdAt?: unknown;
  messages?: unknown;
};

function parseConversation(input: ConversationInput) {
  const id = typeof input.id === "string" ? input.id.trim().slice(0, 100) : "";
  // 缺书卷/章节的旧版经文对话按普通对话保存，而不是整条丢弃
  const rawBook = typeof input.bookCode === "string" ? input.bookCode.trim() : "";
  const kind = input.kind === "scripture" && rawBook && Number(input.chapter) >= 1 && Number(input.verse) >= 1
    ? "scripture"
    : "general";
  const translation =
    typeof input.versionCode === "string" ? input.versionCode.trim().slice(0, 20) : "";
  const book = kind === "scripture" ? rawBook.slice(0, 20) : "";
  const chapter = Number(input.chapter) || 0;
  const verse = Number(input.verse) || 0;
  const verseRefLabel = typeof input.refLabel === "string" ? input.refLabel.trim().slice(0, 120) : "";
  const verseText = typeof input.verseText === "string" ? input.verseText.trim().slice(0, 4000) : "";
  const title = (typeof input.title === "string" ? input.title.trim().slice(0, 80) : "") || verseRefLabel || "慧读对话";
  const createdAt = typeof input.createdAt === "string" ? new Date(input.createdAt) : new Date();
  const rawMessages = Array.isArray(input.messages) ? input.messages.slice(0, 200) : [];
  if (!id || !title || (kind === "scripture" && (!book || chapter < 1 || verse < 1))) return null;

  // 每条消息给递增的时间：同一事务里批量写入时 now() 完全相同，按时间排序会打乱问答顺序
  const baseTime = Number.isNaN(createdAt.getTime()) ? Date.now() : createdAt.getTime();
  const messages = rawMessages.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const message = raw as MessageInput;
    const role = message.role === "assistant" ? "ASSISTANT" as const : message.role === "user" ? "USER" as const : null;
    if (!role) return [];
    const content = typeof message.content === "string"
      ? message.content.trim().slice(0, 20_000)
      : "";
    const blocks = Array.isArray(message.blocks) ? message.blocks : null;
    const sources = Array.isArray(message.sources) ? message.sources : null;
    if (!content && !blocks) return [];
    return [{
      role,
      createdAt: new Date(baseTime + index),
      content,
      blocks: blocks || sources ? { blocks, sources } : undefined,
    }];
  });

  return {
    id,
    translation,
    book,
    chapter,
    verseStart: verse,
    verseEnd: verse,
    verseRefLabel,
    verseText,
    title,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    messages,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  let body: { conversations?: ConversationInput[]; deletions?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式无效" }, { status: 400 });
  }
  const inputs = Array.isArray(body.conversations) ? body.conversations.slice(0, 500) : [];
  const deletions = Array.isArray(body.deletions)
    ? body.deletions.filter((id): id is string => typeof id === "string").slice(0, 500)
    : [];
  // 单条不合格（如缺标题的旧记录）就跳过，不拒绝整批：以前一条坏记录会让这台设备的
  // 慧读记录全部同步不上去，退出登录清空本机后就全部丢失
  const conversations = inputs.map(parseConversation).filter((conversation) => conversation !== null);

  await db.$transaction(async (tx) => {
    if (deletions.length) {
      await tx.conversation.deleteMany({
        where: { userId: user.id, id: { in: deletions } },
      });
    }
    for (const conversation of conversations) {
      if (!conversation) continue;
      const existing = await tx.conversation.findFirst({
        where: { id: conversation.id, userId: user.id },
        select: { id: true },
      });
      if (!existing) {
        // id 已属于其他账号（极少见）：跳过，避免主键冲突让整批事务失败
        const taken = await tx.conversation.findUnique({ where: { id: conversation.id }, select: { id: true } });
        if (taken) continue;
      }
      if (existing) {
        await tx.message.deleteMany({ where: { conversationId: existing.id } });
        await tx.conversation.update({
          where: { id: existing.id },
          data: {
            translation: conversation.translation,
            book: conversation.book,
            chapter: conversation.chapter,
            verseStart: conversation.verseStart,
            verseEnd: conversation.verseEnd,
            verseRefLabel: conversation.verseRefLabel,
            verseText: conversation.verseText,
            title: conversation.title,
            messages: { create: conversation.messages },
          },
        });
      } else {
        await tx.conversation.create({
          data: {
            userId: user.id,
            ...conversation,
            messages: { create: conversation.messages },
          },
        });
      }
    }
  });

  const stored = await db.conversation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  return NextResponse.json({
    ok: true,
    conversations: stored.map((conversation) => ({
      id: conversation.id,
      kind: conversation.book ? "scripture" : "general",
      bookCode: conversation.book || undefined,
      versionCode: conversation.translation || undefined,
      chapter: conversation.chapter,
      verse: conversation.verseStart,
      refLabel: conversation.verseRefLabel,
      verseText: conversation.verseText,
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((message) => {
        const payload = message.blocks && typeof message.blocks === "object"
          ? message.blocks as { blocks?: unknown; sources?: unknown }
          : null;
        return {
          role: message.role === "USER" ? "user" : "assistant",
          content: message.content || undefined,
          blocks: Array.isArray(payload?.blocks) ? payload.blocks : undefined,
          sources: Array.isArray(payload?.sources) ? payload.sources : undefined,
        };
      }),
    })),
  });
}
