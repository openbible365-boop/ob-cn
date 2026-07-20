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
  { tag: "经文释义", color: "#BF78F6", dark: true },
] as const;

const JOHN_3_16_SUMMARY = "这段经文是福音的核心宣示：救恩源于神对世人主动的爱，祂差遣独生子耶稣基督钉十字架完成救赎。我们得救的途径完全是因着信靠祂而得享永生的全新生命，而非依赖行为的积累；这宝贵的应许带给我们面对今天一切忧虑的真实确据，呼召我们以感恩和信心去生活。";

export function generateHuiduBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  // Exact design copy for the flagship verse.
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

export function generateFollowupText(question: string, refLabel: string): string {
  const q = question.trim();
  return [
    `关于「${q}」——回到 ${refLabel} 的语境，可以从经文用词、上下文脉络与相关经文互证三方面来思想。`,
    "建议对照可靠的注释与原文词义进一步查考；若涉及教义判断，也宜与所在教会的教导核对。以下回答仅供参考，不替代权威释经。",
  ].join("\n\n");
}
