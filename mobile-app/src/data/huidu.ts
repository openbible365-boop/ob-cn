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

const JOHN_3_16_SUMMARY = "这段经文是福音的核心宣示：救恩源于神对世人主动的爱，祂差遣独生子耶稣基督钉十字架完成救赎。我们得救的途径完全是因着信靠祂而得享永生的全新生命，而非依赖行为的积累；这宝贵的应许带给我们面对今天一切忧虑的真实确据，呼召我们以感恩和信心去生活。";

export function generateBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  if (refLabel.includes("3:16")) {
    return [
      {
        tag: "经文释义",
        color: "#8750B6",
        dark: true,
        text: JOHN_3_16_SUMMARY,
      },
    ];
  }
  const snippet = verseText.replace(/[「」“”]/g, "").slice(0, 18);
  const text = `《${refLabel}》的真理聚焦在「${snippet}…」。理解这节经文需要回到作者写作时的处境、说话对象与上下文脉络中，默想其中所指向的真理，体验神的性情与救赎心意；建议求神将这宝贵的真理切实带进今天的祷告与生活中，具体更新我们的选择、人际关系与面对担忧时的态度。`;
  return [
    {
      tag: "经文释义",
      color: "#8750B6",
      dark: true,
      text,
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
