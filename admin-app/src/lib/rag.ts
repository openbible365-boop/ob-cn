export type RagChunk = {
  chunk_id: string;
  document_id: string;
  filename: string;
  title: string;
  author: string | null;
  page_number: number | null;
  section_title: string | null;
  verse_start: string | null;
  verse_end: string | null;
  content: string;
  score: number;
};

const RAG_TIMEOUT_MS = 45_000;
const RAG_CACHE_TTL_MS = 10 * 60_000;
const RAG_CACHE_MAX_ENTRIES = 256;
export const COMMENTARY_DISPLAY_TITLE = "《精读本注释》";

type RagCacheEntry = {
  expiresAt: number;
  chunks: RagChunk[];
};

const ragCacheState = globalThis as typeof globalThis & {
  __openBibleRagCache?: Map<string, RagCacheEntry>;
};

const ragCache =
  ragCacheState.__openBibleRagCache ?? new Map<string, RagCacheEntry>();
ragCacheState.__openBibleRagCache = ragCache;

const COMMENTARY_TITLE_ALIASES: Record<string, string> = {
  "cross bw jdb.pdf": COMMENTARY_DISPLAY_TITLE,
  "cross bw jdb": COMMENTARY_DISPLAY_TITLE,
};

export function commentaryDisplayName(value: string) {
  const cleanValue = value.trim();
  return COMMENTARY_TITLE_ALIASES[cleanValue.toLocaleLowerCase()] ?? cleanValue;
}

function normalizedCacheKey(query: string, limit: number) {
  return `${limit}\u0000${query.trim().replace(/\s+/g, " ")}`;
}

function readCachedChunks(key: string) {
  const cached = ragCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    ragCache.delete(key);
    return undefined;
  }
  // Refresh insertion order so the size cap behaves like a small LRU cache.
  ragCache.delete(key);
  ragCache.set(key, cached);
  return cached.chunks;
}

function cacheChunks(key: string, chunks: RagChunk[]) {
  if (ragCache.size >= RAG_CACHE_MAX_ENTRIES) {
    const oldestKey = ragCache.keys().next().value;
    if (oldestKey) ragCache.delete(oldestKey);
  }
  ragCache.set(key, {
    expiresAt: Date.now() + RAG_CACHE_TTL_MS,
    chunks,
  });
}

export async function retrieveCommentary(
  query: string,
  limit = 6,
): Promise<RagChunk[]> {
  const baseUrl = process.env.OPENBIBLE_RAG_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OPENBIBLE_RAG_INTERNAL_API_KEY;
  if (!baseUrl || !apiKey) {
    console.warn("RAG retrieval is not configured; continuing without commentary context");
    return [];
  }

  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const cacheKey = normalizedCacheKey(query, safeLimit);
  const cachedChunks = readCachedChunks(cacheKey);
  if (cachedChunks) return cachedChunks;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/internal/retrieve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": apiKey,
      },
      body: JSON.stringify({ query, limit: safeLimit, threshold: 0.15 }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("RAG upstream error", response.status, await response.text());
      return [];
    }
    const result = (await response.json()) as unknown;
    if (!Array.isArray(result)) return [];
    const chunks = (result as RagChunk[]).map((chunk) => ({
      ...chunk,
      filename: commentaryDisplayName(chunk.filename),
      title: commentaryDisplayName(chunk.title),
    }));
    cacheChunks(cacheKey, chunks);
    return chunks;
  } catch (error) {
    console.error("RAG retrieval failed", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function formatRagContext(chunks: RagChunk[]): string {
  if (!chunks.length) return "";
  return chunks
    .map((chunk, index) => {
      const page = chunk.page_number ? `，第 ${chunk.page_number} 页` : "";
      const section = chunk.section_title ? `，章节：${chunk.section_title}` : "";
      return `[资料${index + 1}] 来源：${COMMENTARY_DISPLAY_TITLE}${page}${section}\n${chunk.content}`;
    })
    .join("\n\n");
}
