// 对应网页版原 POST /api/ai/eval/tag-explain — 点击主题标签的三段式深度解读。
// body: { book_code, book_name, chapter, tag, version } → { answer }
// 前端会按 "1. / 2. / 3." 拆分为三个小节渲染，模板与 LLM 输出都遵守该格式。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import {
  bookLabel,
  cacheGet,
  cacheSet,
  checkWebAiRate,
  clientKey,
  langOfVersion,
  LANG_NAME,
  tryLLM,
} from "@/lib/web-ai";

export const runtime = "nodejs";

function templateAnswer(bookName: string, chapter: number, tag: string, lang: "zh" | "en" | "ko") {
  if (lang === "en") {
    return [
      `1. "${tag}" surfaces repeatedly in ${bookName} ${chapter} and carries the chapter's main thread.`,
      `2. Within this chapter, "${tag}" should be read through the flow of events and the author's emphasis; trace the verses where it appears and note what God says and does.`,
      `3. Across Scripture this theme connects with related passages — follow a concordance or cross-references to see how it unfolds from Genesis to Revelation.`,
    ].join("\n");
  }
  if (lang === "ko") {
    return [
      `1. 「${tag}」은(는) ${bookName} ${chapter}장의 흐름을 이끄는 중심 주제어입니다.`,
      `2. 본 장에서 「${tag}」은(는) 사건의 전개와 저자의 강조점 속에서 읽어야 합니다. 이 단어가 나오는 구절을 따라가며 하나님의 말씀과 행하심을 살펴보십시오.`,
      `3. 성경 전체에서 이 주제는 관련 구절들과 서로 연결됩니다. 관주와 상호참조를 따라 창세기부터 계시록까지의 전개를 살펴보시기 바랍니다.`,
    ].join("\n");
  }
  return [
    `1. 「${tag}」在《${bookName}》第${chapter}章中反复出现，承载着本章叙事与信息的主线，因此被选为关键词。`,
    `2. 在本章语境中，「${tag}」需要放在事件推进与作者强调的重点里理解；建议循着它出现的经节，留意神的言语与作为。`,
    `3. 从全本圣经看，这一主题与相关书卷彼此呼应；可借串珠与交叉参考，追踪它从创世记到启示录的展开。`,
  ].join("\n");
}

export async function POST(request: Request) {
  let body: {
    book_code?: unknown;
    book_name?: unknown;
    chapter?: unknown;
    tag?: unknown;
    version?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "请求格式错误" }, { status: 400 });
  }

  const bookCode = typeof body.book_code === "string" ? body.book_code.trim() : "";
  const chapter = Number.parseInt(String(body.chapter ?? ""), 10) || 1;
  const tag = typeof body.tag === "string" ? body.tag.trim().slice(0, 40) : "";
  const lang = langOfVersion(typeof body.version === "string" ? body.version : null);
  const bookName =
    typeof body.book_name === "string" && body.book_name.trim()
      ? body.book_name.trim().slice(0, 40)
      : bookLabel(bookCode, lang);
  if (!tag) return NextResponse.json({ detail: "缺少主题标签" }, { status: 400 });

  const cacheKey = `tag-explain:${lang}:${bookCode || bookName}:${chapter}:${tag}`;
  const cached = cacheGet<{ answer: string }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const user = await getSessionUser();
  if (!checkWebAiRate(clientKey(request, user?.id ?? null), Boolean(user))) {
    return NextResponse.json({ answer: templateAnswer(bookName, chapter, tag, lang) });
  }

  const raw = await tryLLM({
    systemPrompt: `你是 OpenBible 的主题标签解读助手。用户给出书卷、章数与一个主题标签，请输出严格分为三段的解读，格式必须是：
1. <为何这个词被选为本章关键词>
2. <这个词在本章中的具体涵义，引用相关经节>
3. <这个主题与其它书卷的关联，标明书卷章节>
要求：使用${LANG_NAME[lang]}；每段 120 字以内；忠于经文，不虚构出处；除这三段外不要输出任何其它文字。`,
    messages: [{ role: "user", content: `书卷：${bookName}（${bookCode || "?"}）第${chapter}章，主题标签：「${tag}」` }],
    maxTokens: 700,
  });

  const payload = { answer: raw ?? templateAnswer(bookName, chapter, tag, lang) };
  if (raw) cacheSet(cacheKey, payload);
  return NextResponse.json(payload);
}
