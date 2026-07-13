// Offline scripture: the full authentic 和合本（新标点，简体）约翰福音 —
// same public-domain CUNPS dataset used by the web backend, bundled with the
// app so reading works with no network.
import raw from "./john-cuv.json";

export const BOOK = "约翰福音";
export const TRANSLATION = "和合本";

type RawData = {
  translation: string;
  book: string;
  verses: { chapter: number; verse: number; text: string }[];
};

const data = raw as RawData;

export const MAX_CHAPTER = data.verses.reduce((m, v) => Math.max(m, v.chapter), 1);

export function getChapter(chapter: number) {
  return data.verses.filter((v) => v.chapter === chapter);
}

export function getVerse(chapter: number, verse: number) {
  return data.verses.find((v) => v.chapter === chapter && v.verse === verse) ?? null;
}

export type CommentarySection = {
  title: string;
  body: string;
  highlight?: boolean;
};

// 精读本注释 — editorial content for John 3 (matches the design).
const COMMENTARY: Record<number, CommentarySection[]> = {
  3: [
    {
      title: "3:1–8 · 重生的对话",
      body: "尼哥底母是法利赛人、犹太公会的成员，夜里来见耶稣，既出于谨慎，也暗示他尚在黑暗中摸索。「重生」原文亦作「从上头生」：不是道德修补，而是圣灵所赐的全新生命。「风随着意思吹」以风喻灵，指明重生是神主权的工作。",
    },
    {
      title: "3:9–15 · 举蛇的预表",
      body: "耶稣引用民数记 21 章旷野举铜蛇的事件：百姓仰望铜蛇便得医治，预表人子将被举起在十字架上——凡仰望信靠他的，就得永生。「举起」在约翰福音中兼指被钉与得荣耀。",
    },
    {
      title: "3:16–17 · 福音中的福音",
      highlight: true,
      body: "本段是整卷约翰福音信息的浓缩。「爱」（agapaō）指神主动、舍己的爱；「世人」表明这爱临到普世众人。「独生子」（monogenēs）强调基督与父独一无二的关系；「赐给」呼应 3:14 被举起的人子——爱在十字架上成为具体行动。定罪不是神差子的目的（3:17），信而得生才是。",
    },
    {
      title: "3:18–21 · 光与黑暗的分野",
      body: "信与不信在此刻已分出结局：不信者「罪已经定了」。光来到世间成为试金石——人对光的态度显明其行为的本相；行真理的必来就光。",
    },
  ],
};

export function getCommentary(chapter: number): CommentarySection[] {
  return COMMENTARY[chapter] ?? [];
}
