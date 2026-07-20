// 慧读 conversations — persisted locally. Answers are the same templated
// three-part structure used by the web backend (no external LLM yet; the
// UI keeps the standing disclaimer). Swapping in a real model later only
// replaces the two generate* functions.
import { load, save, uid } from "./store";

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
  { tag: "经文释义", color: "#BF78F6", dark: true },
] as const;

const JOHN_3_16_SUMMARY = "这段经文是福音的核心宣示：救恩源于神对世人主动的爱，祂差遣独生子耶稣基督钉十字架完成救赎。我们得救的途径完全是因着信靠祂而得享永生的全新生命，而非依赖行为的积累；这宝贵的应许带给我们面对今天一切忧虑的真实确据，呼召我们以感恩和信心去生活。";

export function generateBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  if (refLabel.includes("3:16")) {
    return [
      {
        tag: "经文释义",
        color: "#BF78F6",
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
      color: "#BF78F6",
      dark: true,
      text,
    },
  ];
}

export function generateFollowup(question: string, refLabel: string): string {
  return [
    `关于「${question.trim()}」——回到 ${refLabel} 的语境，可以从经文用词、上下文脉络与相关经文互证三方面来思想。`,
    "建议对照可靠的注释与原文词义进一步查考；若涉及教义判断，也宜与所在教会的教导核对。以上回答仅供参考，不替代权威释经。",
  ].join("\n\n");
}

export function getConversations(): Conversation[] {
  return load<Conversation[]>(KEY, []);
}

export function getConversation(id: string) {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function startConversation(bookName: string, chapter: number, verse: number, verseText: string, customRefLabel?: string): Conversation {
  const refLabel = customRefLabel ?? `${bookName} ${chapter}:${verse}`;
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

export function askFollowup(id: string, question: string): Conversation | null {
  const all = getConversations();
  const conv = all.find((c) => c.id === id);
  if (!conv) return null;
  conv.messages = [
    ...conv.messages,
    { role: "user", content: question },
    { role: "assistant", content: generateFollowup(question, conv.refLabel) },
  ];
  save(KEY, all);
  return conv;
}
