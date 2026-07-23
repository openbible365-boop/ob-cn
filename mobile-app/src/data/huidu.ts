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

export function getConversation(id: string) {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function startConversation(bookName: string, chapter: number, verse: number, verseText: string, customRefLabel?: string): Conversation {
  const refLabel = customRefLabel ?? `${bookName} ${chapter}:${verse}`;
  const isMultiVerse = Boolean(customRefLabel && customRefLabel !== `${bookName} ${chapter}:${verse}`);
  const conv: Conversation = {
    id: uid(),
    chapter,
    verse,
    refLabel,
    verseText,
    title: `${refLabel} 的历史背景与生活应用`,
    createdAt: new Date().toISOString(),
    messages: [
      { role: "user", content: isMultiVerse ? "请为我解释这些经文" : "请为我解释这节经文" },
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
