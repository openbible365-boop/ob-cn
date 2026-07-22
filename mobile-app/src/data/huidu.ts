// 慧读 conversations are persisted locally. Opening explanations keep the
// existing three-part presentation; follow-up questions are answered by the
// authenticated Qwen API and then stored in the same local thread.
import { load, save, uid } from "./store";
import { apiRequest } from "./api";

export type HuiduBlock = { tag: string; color: string; dark: boolean; text: string };
export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string; blocks?: HuiduBlock[] };
export type Conversation = {
  id: string;
  chapter: number;
  verse: number;
  refLabel: string;
  verseText: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

const KEY = "ob.conversations";

const TAGS = [
  { tag: "历史背景", color: "#FFD465", dark: false },
  { tag: "核心含义", color: "#BF78F6", dark: true },
  { tag: "生活应用", color: "#E98264", dark: true },
] as const;

const JOHN_3_16: Record<string, string> = {
  历史背景:
    "这句话出自耶稣与法利赛人尼哥底母的夜间对话。「举蛇」呼应民数记 21 章：旷野中仰望铜蛇得医治，预表人子将在十字架上被举起。",
  核心含义:
    "「神爱世人」宣告救恩源于神主动的爱；「独生子」强调基督身份的独一。领受永生的途径是信靠，而非行为的积累。",
  生活应用:
    "永生不是遥远的奖赏，而是从相信那一刻开始的新生命。试着把「不至灭亡」的确据，带进你今天正在担忧的事情里，以感恩回应这份主动的爱。",
};

export function generateBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  if (refLabel.includes("3:16")) {
    return TAGS.map((t) => ({ ...t, text: JOHN_3_16[t.tag] }));
  }
  const snippet = verseText.replace(/[「」“”]/g, "").slice(0, 18);
  const templates: Record<string, string> = {
    历史背景: `${refLabel} 需放回其上下文来读：留意作者写作的处境、说话的对象，以及与前后经文的呼应，能帮助我们避免断章取义。`,
    核心含义: `这节经文的重心在于「${snippet}…」所指向的真理。默想其中的关键词，思考它如何见证神的性情与救赎的心意。`,
    生活应用: `把这节经文带进祷告：求神让「${snippet}…」的信息，具体地更新你今天的态度、选择与人际关系。`,
  };
  return TAGS.map((t) => ({ ...t, text: templates[t.tag] }));
}

export function getConversations(): Conversation[] {
  return load<Conversation[]>(KEY, []);
}

export function getConversation(id: string) {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function startConversation(bookName: string, chapter: number, verse: number, verseText: string): Conversation {
  const refLabel = `${bookName} ${chapter}:${verse}`;
  const conv: Conversation = {
    id: uid(),
    chapter,
    verse,
    refLabel,
    verseText,
    title: `${refLabel} 的历史背景与生活应用`,
    createdAt: new Date().toISOString(),
    messages: [
      { role: "user", content: "请为我解释这节经文" },
      { role: "assistant", blocks: generateBlocks(refLabel, verseText) },
    ],
  };
  save(KEY, [conv, ...getConversations()]);
  return conv;
}

export type HuiduAssistantResult =
  | { ok: true; answer: string }
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
      { ok: true; answer: string } | { ok: false; message?: string }
    >("/api/mobile/huidu/assistant", {
      method: "POST",
      body: {
        conversationId: conversation.id,
        refLabel: conversation.refLabel,
        verseText: conversation.verseText,
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

    return { ok: true, answer: result.answer };
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
): Conversation | null {
  const all = getConversations();
  const conv = all.find((c) => c.id === id);
  if (!conv) return null;
  conv.messages = [
    ...conv.messages,
    { role: "user", content: question },
    { role: "assistant", content: answer },
  ];
  save(KEY, all);
  return conv;
}
