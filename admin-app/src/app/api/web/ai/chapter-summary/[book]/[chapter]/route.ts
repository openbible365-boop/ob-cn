// 对应网页版原 GET /api/ai/chapter-summary/{book}/{chapter}?version=
// 返回本章速览 + 主题标签 + 启发探索问题。
// 有 LLM 时实时生成并缓存；未配置时回退：标签取经文小标题，问题用模板。
import { NextResponse } from "next/server";
import { chapterVerses, normalizeBookCode, jsonError } from "@/lib/web-compat";
import { getSessionUser } from "@/lib/current-user";
import {
  bookLabel,
  cacheGet,
  cacheSet,
  checkWebAiRate,
  clientKey,
  langOfVersion,
  LANG_NAME,
  parseJsonLoose,
  tryLLM,
} from "@/lib/web-ai";

export const runtime = "nodejs";

type SummaryPayload = {
  answer: string | null;
  theme_tags: string[];
  explore_chips: { emoji: string; question: string }[];
};

const MAX_CHAPTER_CHARS = 6000;

function templateChips(book: string, chapter: number, lang: "zh" | "en" | "ko") {
  const name = bookLabel(book, lang);
  if (lang === "en") {
    return [
      { emoji: "📜", question: `What is the historical background of ${name} ${chapter}?` },
      { emoji: "💡", question: `What is the core message of ${name} ${chapter}?` },
      { emoji: "🙏", question: `How can I apply ${name} ${chapter} to my life today?` },
    ];
  }
  if (lang === "ko") {
    return [
      { emoji: "📜", question: `${name} ${chapter}장의 역사적 배경은 무엇인가요?` },
      { emoji: "💡", question: `${name} ${chapter}장의 핵심 메시지는 무엇인가요?` },
      { emoji: "🙏", question: `${name} ${chapter}장을 오늘의 삶에 어떻게 적용할 수 있나요?` },
    ];
  }
  return [
    { emoji: "📜", question: `${name} 第${chapter}章的历史背景是什么？` },
    { emoji: "💡", question: `这一章的核心信息是什么？` },
    { emoji: "🙏", question: `如何把${name} 第${chapter}章应用到今天的生活？` },
  ];
}

export async function GET(
  request: Request,
  context: { params: Promise<{ book: string; chapter: string }> },
) {
  const { book: rawBook, chapter: rawChapter } = await context.params;
  const book = normalizeBookCode(rawBook);
  const chapter = Number.parseInt(rawChapter, 10);
  if (!book || !Number.isFinite(chapter) || chapter < 1) {
    return jsonError("无效的书卷或章节", 400);
  }

  const url = new URL(request.url);
  const version = url.searchParams.get("version") || "cuv";
  const lang = langOfVersion(version);

  const verses = await chapterVerses(version, book, chapter);
  if (verses.length === 0) return jsonError("未找到该章经文", 404);

  const cacheKey = `chapter-summary:${version}:${book}:${chapter}`;
  const cached = cacheGet<SummaryPayload>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const headings = [...new Set(verses.map((v) => v.heading).filter(Boolean))].slice(0, 4) as string[];
  const fallback: SummaryPayload = {
    answer: null,
    theme_tags: headings,
    explore_chips: templateChips(book, chapter, lang),
  };

  const user = await getSessionUser();
  if (!checkWebAiRate(clientKey(request, user?.id ?? null), Boolean(user))) {
    // 限流时直接给模板，不算失败
    return NextResponse.json(fallback);
  }

  const bookName = bookLabel(book, lang);
  const chapterText = verses
    .map((v) => `${v.verse} ${v.text}`)
    .join("\n")
    .slice(0, MAX_CHAPTER_CHARS);

  const raw = await tryLLM({
    systemPrompt: `你是 OpenBible 的章节速览生成器。根据用户提供的整章经文，生成 JSON（不要包含其它文字）：
{"summary":"该章 120 字以内的速览","theme_tags":["主题词1","主题词2","主题词3"],"questions":[{"emoji":"合适的emoji","question":"启发探索问题"},...共3个]}
要求：
1. 全部使用${LANG_NAME[lang]}。
2. summary 概括主线事件与神学重点，忠于经文，不外加教义判断。
3. theme_tags 是 2-6 字的主题词。
4. questions 是读者会想深入追问的问题，具体到本章内容。`,
    messages: [{ role: "user", content: `${bookName} 第${chapter}章：\n${chapterText}` }],
    maxTokens: 700,
  });

  let payload = fallback;
  if (raw) {
    const parsed = parseJsonLoose<{
      summary?: string;
      theme_tags?: string[];
      questions?: { emoji?: string; question?: string }[];
    }>(raw);
    if (parsed?.summary) {
      payload = {
        answer: parsed.summary,
        theme_tags: (parsed.theme_tags ?? headings).filter(Boolean).slice(0, 4),
        explore_chips: (parsed.questions ?? [])
          .filter((q) => q?.question)
          .slice(0, 3)
          .map((q) => ({ emoji: q.emoji || "💡", question: q.question! })),
      };
      if (payload.explore_chips.length === 0) payload.explore_chips = fallback.explore_chips;
      cacheSet(cacheKey, payload);
    }
  }

  return NextResponse.json(payload);
}
