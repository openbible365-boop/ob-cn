// 网页版 AI 接口的共用底座：语言推断、限流、缓存与 LLM 调用降级。
//
// LLM 通过 lib/qwen.ts 走统一网关（OPENBIBLE_LLM_* 环境变量）。未配置密钥
// 或调用失败时，各路由回退到确定性模板——页面始终可用，配好密钥即自动
// 升级为真实生成，无需改前端。
import { requestQwen, type QwenChatMessage } from "@/lib/qwen";
import { BOOKS } from "@/lib/bible-books";

export type WebLang = "zh" | "en" | "ko";

export function langOfVersion(version: string | null | undefined): WebLang {
  if (version === "kjv") return "en";
  if (version === "keb" || version === "krv" || version === "snr") return "ko";
  return "zh";
}

export function bookLabel(code: string, lang: WebLang) {
  const book = BOOKS.find((item) => item.code === code);
  if (!book) return code;
  return lang === "en" ? book.en : lang === "ko" ? book.ko : book.zh;
}

export const LANG_NAME: Record<WebLang, string> = {
  zh: "简体中文",
  en: "English",
  ko: "한국어",
};

// ── 限流：登录用户 12 次/分，匿名 4 次/分 ──
const WINDOW_MS = 60_000;
const LIMIT_AUTHED = 12;
const LIMIT_ANON = 4;

type RateEntry = { count: number; resetAt: number };
const rateState = globalThis as typeof globalThis & {
  __openBibleWebAiRate?: Map<string, RateEntry>;
};
const rateLimits = rateState.__openBibleWebAiRate ?? new Map<string, RateEntry>();
if (process.env.NODE_ENV !== "production") {
  rateState.__openBibleWebAiRate = rateLimits;
}

export function clientKey(request: Request, userId: string | null) {
  if (userId) return `u:${userId}`;
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${fwd || "local"}`;
}

export function checkWebAiRate(key: string, authed: boolean) {
  const now = Date.now();
  const limit = authed ? LIMIT_AUTHED : LIMIT_ANON;
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

// ── 结果缓存（进程内 TTL）：同一章/同一问题不重复调模型 ──
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

type CacheEntry = { expiresAt: number; payload: unknown };
const cacheState = globalThis as typeof globalThis & {
  __openBibleWebAiCache?: Map<string, CacheEntry>;
};
const cache = cacheState.__openBibleWebAiCache ?? new Map<string, CacheEntry>();
if (process.env.NODE_ENV !== "production") {
  cacheState.__openBibleWebAiCache = cache;
}

export function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.payload as T;
}

export function cacheSet(key: string, payload: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

// ── LLM 调用：成功返回文本，未配置或失败返回 null（路由走模板降级）──
export async function tryLLM(input: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
}): Promise<string | null> {
  const result = await requestQwen(input);
  if (result.ok) return result.answer;
  if (result.status !== 503) {
    console.warn("[web-ai] LLM 调用失败，走模板降级：", result.message);
  }
  return null;
}

// 模型被要求返回 JSON 时的宽松解析：剥掉围栏，失败返回 null
export function parseJsonLoose<T>(raw: string): T | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
