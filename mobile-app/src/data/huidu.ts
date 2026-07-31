// 慧读 conversations are persisted locally. Opening explanations keep the
// existing three-part presentation; follow-up questions are answered by the
// authenticated Qwen API and then stored in the same local thread.
import { load, save, uid } from "./store";
import { apiRequest } from "./api";

export type HuiduBlock = { tag: string; color: string; dark: boolean; text: string };
export type HuiduSource = {
  id: string;
  kind: "scripture" | "commentary" | "community";
  label: string;
  title?: string;
  bookCode?: string;
  versionCode?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  resourceId?: string;
};
export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string; blocks?: HuiduBlock[]; sources?: HuiduSource[] };
export type Conversation = {
  id: string;
  kind?: "scripture" | "general";
  bookCode?: string;
  versionCode?: string;
  chapter: number;
  verse: number;
  refLabel: string;
  verseText: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

const KEY = "ob.conversations";
const PENDING_KEY = "ob.conversationPendingOps";
type PendingConversationOperation = { id: string; type: "upsert" | "delete"; conversationId: string };
let syncPromise: Promise<boolean> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;

export function generateBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  const lines = verseText.split("\n\n").filter(Boolean);

  // 1. 生成“逐节深入解读”的内容：对每一节经文单独生成一段
  const detailedInterpretations = lines.map((line) => {
    const colonIndex = line.indexOf("节：");
    let label = "";
    let content = line;
    if (colonIndex > 0) {
      label = line.slice(0, colonIndex);
      content = line.slice(colonIndex + 2);
    }
    const snippet = content.replace(/[「」“”]/g, "").slice(0, 16);
    
    if (refLabel.includes("3:16") && label === "16") {
      return `【第 16 节解读】：“神爱世人，甚至将祂的独生子赐给他们，叫一切信祂的，不至灭亡，反得永生。”这是救赎真理的最高峰。经文层层推进：爱的源头是神，爱的对象是世人，爱的重要彰显是赐下独生爱子，而爱的得救途径是完全的信靠而非人为努力。这呼召我们全然躺平在神深沉的安全感中。`;
    }
    
    return `【第 ${label || "?"} 节解读】：“${content.slice(0, 30)}${content.length > 30 ? "…" : ""}” —— 经文聚焦在「${snippet}…」的真理上。我们要探究本节的核心原文字词，剖析其文化背景，并重点体会其在上下文中的叙事脉络与神的救赎心意。`;
  }).join("\n\n");

  const isJohn316 = refLabel.includes("3:16") && lines.length === 1;

  if (isJohn316) {
    return [
      {
        tag: "逐节深入解读",
        color: "#8750B6",
        dark: true,
        text: "“神爱世人，甚至将祂的独生子赐给他们，叫一切信祂的，不至灭亡，反得永生。”经文首先展现了神爱的无限范围（世人），以及祂倾其所有的无私给予（赐下独生子）。“一切信祂的”指明了救恩的普遍性与白白的应许，通过信靠而非行为，指引我们免于最终的失丧（不至灭亡），进入那永恒的、与神同在的丰盛生命（反得永生）。",
      },
      {
        tag: "神学核心和现实意义",
        color: "#27AE60",
        dark: true,
        text: "这节经文宣告了救恩完全由神主动并发起的爱（God's active love）。神学核心在于：神并非冷眼旁观，而是用重价完成救赎。在现实中，这带给我们绝不动摇的安全感：无论我们身处顺境还是面临现实中的重重忧虑，只要确信这深沉的爱，就能驱散恐惧，并在人际交往中活出无条件接纳与付出的爱。",
      },
      {
        tag: "总结",
        color: "#E89A2C",
        dark: true,
        text: "约翰福音 3:16 是整本圣经福音核心的缩影。它不仅是一个神学概念，更是一份随时随地活水般的呼召，呼召我们带着感恩、凭着信心在每一天的选择中，活出蒙爱、自由的永生生命样式。",
      },
    ];
  }

  const firstLine = lines[0] || "";
  const firstLineColon = firstLine.indexOf("节：");
  const mainSnippet = (firstLineColon > 0 ? firstLine.slice(firstLineColon + 2) : firstLine)
    .replace(/[「」“”]/g, "")
    .slice(0, 16);

  return [
    {
      tag: "逐节深入解读",
      color: "#8750B6",
      dark: true,
      text: detailedInterpretations,
    },
    {
      tag: "神学核心和现实意义",
      color: "#27AE60",
      dark: true,
      text: `这段经文折射出了极其宝贵的神学核心真理（如神的恩典、主权或救赎心意），并对今天的我们提出具体的要求：在面临职场、人际关系、内心焦虑或生活抉择时，我们应当把该核心真理切实应用到现实生活中，以此更新我们的信心与日常行事为人。`,
    },
    {
      tag: "总结",
      color: "#E89A2C",
      dark: true,
      text: `总之，这几节经文不仅是一句警醒或应许，更是一个在信仰旅程中随时的指引。建议今天以“${mainSnippet}…”这部分宝贵真理进行默想与祷告，使其切实在您的日常中发芽结实。`,
    },
  ];
}

export function getConversations(): Conversation[] {
  return load<Conversation[]>(KEY, []);
}

function saveConversations(conversations: Conversation[]) {
  save(KEY, conversations);
}

function queueOperation(type: PendingConversationOperation["type"], conversationId: string) {
  const rest = load<PendingConversationOperation[]>(PENDING_KEY, [])
    .filter((operation) => operation.conversationId !== conversationId);
  save(PENDING_KEY, [...rest, { id: uid(), type, conversationId }]);
}

function scheduleSync() {
  if (typeof window === "undefined") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncConversations(); }, 450);
}

export function getConversation(id: string) {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function deleteConversation(id: string) {
  const remaining = getConversations().filter((conversation) => conversation.id !== id);
  saveConversations(remaining);
  queueOperation("delete", id);
  scheduleSync();
  return remaining;
}

export function hasScriptureContext(conversation: Conversation) {
  return conversation.kind !== "general" && Boolean(conversation.refLabel && conversation.verseText);
}

export function updateConversationTitle(id: string, title: string) {
  const conversations = getConversations();
  const conversation = conversations.find((item) => item.id === id);
  if (!conversation) return null;
  conversation.title = title.trim().slice(0, 40) || conversation.title;
  saveConversations(conversations);
  queueOperation("upsert", id);
  scheduleSync();
  return conversation;
}

function automaticTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/[。！？!?]/)[0]?.trim() || normalized;
  return firstSentence.length > 18 ? `${firstSentence.slice(0, 18)}…` : firstSentence;
}

export function startGeneralConversation(title: string, question: string): Conversation {
  const conv: Conversation = {
    id: uid(),
    kind: "general",
    chapter: 0,
    verse: 0,
    refLabel: "",
    verseText: "",
    title: title.trim().slice(0, 40) || automaticTitle(question) || "新的 AI 对话",
    createdAt: new Date().toISOString(),
    messages: [],
  };
  saveConversations([conv, ...getConversations()]);
  queueOperation("upsert", conv.id);
  scheduleSync();
  return conv;
}

export function startConversation(
  bookName: string,
  chapter: number,
  verse: number,
  verseText: string,
  customRefLabel?: string,
  context?: { bookCode?: string; versionCode?: string },
): Conversation {
  const refLabel = customRefLabel ?? `${bookName} ${chapter}:${verse}`;
  const conv: Conversation = {
    id: uid(),
    kind: "scripture",
    bookCode: context?.bookCode,
    versionCode: context?.versionCode,
    chapter,
    verse,
    refLabel,
    verseText,
    title: `${refLabel} 的历史背景与生活应用`,
    createdAt: new Date().toISOString(),
    messages: [
      { role: "user", content: "请为我解释这节经文" },
      {
        role: "assistant",
        blocks: generateBlocks(refLabel, verseText),
        sources: [
          {
            id: `scripture-${context?.versionCode ?? "cuv"}-${context?.bookCode ?? ""}-${chapter}-${verse}`,
            kind: "scripture",
            label: refLabel,
            title: "本轮经文",
            bookCode: context?.bookCode,
            versionCode: context?.versionCode,
            chapter,
            verseStart: verse,
            verseEnd: verse,
          },
        ],
      },
    ],
  };
  saveConversations([conv, ...getConversations()]);
  queueOperation("upsert", conv.id);
  scheduleSync();
  return conv;
}

export type HuiduAssistantResult =
  | { ok: true; answer: string; sources: HuiduSource[] }
  | { ok: false; message: string; status?: number };

function messageContent(message: Message) {
  if (message.role === "user") return message.content;
  if (message.content) return message.content;
  return (message.blocks ?? [])
    .map((block) => `${block.tag}：${block.text}`)
    .join("\n");
}

export async function requestHuiduFollowup(
  conversation: Conversation,
  question: string,
): Promise<HuiduAssistantResult> {
  try {
    const response = await apiRequest<
      { ok: true; answer: string; sources?: HuiduSource[] } | { ok: false; message?: string }
    >("/api/mobile/huidu/assistant", {
      method: "POST",
      body: {
        conversationId: conversation.id,
        refLabel: conversation.refLabel,
        verseText: conversation.verseText,
        bookCode: conversation.bookCode,
        versionCode: conversation.versionCode,
        chapter: conversation.chapter,
        verse: conversation.verse,
        question,
        history: conversation.messages.map((message) => ({
          role: message.role,
          content: messageContent(message),
        })),
      },
    });
    const result = response.data;

    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        message:
          result && "message" in result && result.message
            ? result.message
            : "慧读模型暂时不可用，请稍后再试",
        status: response.status,
      };
    }

    return {
      ok: true,
      answer: result.answer,
      sources: Array.isArray(result.sources) ? result.sources : [],
    };
  } catch {
    return {
      ok: false,
      message: "网络连接失败，请检查网络后重试",
    };
  }
}

export function appendFollowup(
  id: string,
  question: string,
  answer: string,
  sources: HuiduSource[] = [],
): Conversation | null {
  const all = getConversations();
  const conv = all.find((c) => c.id === id);
  if (!conv) return null;
  if (conv.title === "新的 AI 对话" && conv.messages.length === 0) {
    conv.title = automaticTitle(question) || conv.title;
  }
  conv.messages = [
    ...conv.messages,
    { role: "user", content: question },
    { role: "assistant", content: answer, sources },
  ];
  saveConversations(all);
  queueOperation("upsert", id);
  scheduleSync();
  return conv;
}

export function syncConversations(): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const operations = load<PendingConversationOperation[]>(PENDING_KEY, []);
    const sentIds = new Set(operations.map((operation) => operation.id));
    try {
      const response = await apiRequest<{ conversations?: Conversation[] }>(
        "/api/mobile/huidu/conversations",
        {
          method: "POST",
          body: {
            conversations: getConversations(),
            deletions: operations
              .filter((operation) => operation.type === "delete")
              .map((operation) => operation.conversationId),
          },
        },
      );
      if (
        response.status === 401 ||
        !response.ok ||
        !Array.isArray(response.data?.conversations)
      ) return false;

      const remaining = load<PendingConversationOperation[]>(PENDING_KEY, [])
        .filter((operation) => !sentIds.has(operation.id));
      save(PENDING_KEY, remaining);
      let merged = response.data.conversations.map((conversation) => ({
        ...conversation,
        createdAt: String(conversation.createdAt),
      }));
      for (const operation of remaining) {
        if (operation.type === "delete") {
          merged = merged.filter((conversation) => conversation.id !== operation.conversationId);
          continue;
        }
        const local = getConversations().find(
          (conversation) => conversation.id === operation.conversationId,
        );
        if (local) {
          merged = [local, ...merged.filter((conversation) => conversation.id !== local.id)];
        }
      }
      saveConversations(merged);
      if (remaining.length) scheduleSync();
      return true;
    } catch {
      return false;
    }
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}
