// 慧读 answer generation.
//
// Per the current scope this is a *templated mock*, not a real LLM call — no
// external model is invoked. The structure (三段式：历史背景 / 核心含义 /
// 生活应用) and the John 3:16 sample match the design verbatim; other verses
// get a respectful generic template. Swapping in a real Anthropic call later
// only means replacing `generateHuiduBlocks` / `generateFollowupText` with an
// API call that returns the same shapes. The UI already shows the standing
// disclaimer that answers are AI-assisted and not authoritative exegesis.

export type HuiduBlock = {
  tag: string;
  color: string;
  dark: boolean;
  text: string;
};

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

export function generateHuiduBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  // Exact design copy for the flagship verse.
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

export function generateFollowupText(question: string, refLabel: string): string {
  const q = question.trim();
  return [
    `关于「${q}」——回到 ${refLabel} 的语境，可以从经文用词、上下文脉络与相关经文互证三方面来思想。`,
    "建议对照可靠的注释与原文词义进一步查考；若涉及教义判断，也宜与所在教会的教导核对。以下回答仅供参考，不替代权威释经。",
  ].join("\n\n");
}
