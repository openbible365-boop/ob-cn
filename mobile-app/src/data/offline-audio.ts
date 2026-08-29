// 语音圣经整卷缓存：把一卷书（当前音色）的全部章节音频与逐节时间戳
// 存进 Cache Storage，离线也能听。
//
// 音频文件在跨域 CDN 上，直接 fetch 会被 CORS 拦；一律经同域代理
// /api/mobile/audio/file 拉取（服务端还有磁盘缓存，整卷连拉不必每章回源）。
import { load, save } from "./store";

const CACHE_NAME = "ob-audio-v1";
const META_KEY = "ob.offline-audio";

export type OfflineAudioMeta = {
  chapters: number;      // 实际缓存到的章数
  totalChapters: number; // 该卷总章数
  bytes: number;
  at: string;
};

type Meta = Record<string, OfflineAudioMeta>;

export function offlineAudioSupported() {
  return typeof caches !== "undefined";
}

// 缓存键按 音色+书卷 区分：同一卷的男女声是两份缓存
export function audioPackKey(book: string, voice: string) {
  return `${voice}:${book}`;
}

export function getOfflineAudioMeta(): Meta {
  return load<Meta>(META_KEY, {});
}

function fileUrl(version: string, book: string, chapter: number, voice: string) {
  return `/api/mobile/audio/file?version=${version}&book=${book}&chapter=${chapter}&voice=${voice}`;
}

function metaUrl(version: string, book: string, chapter: number, voice: string) {
  return `/api/mobile/audio?version=${version}&book=${book}&chapter=${chapter}&voice=${voice}`;
}

export async function downloadBookAudio(
  version: string,
  book: string,
  totalChapters: number,
  voice: string,
  onProgress: (done: number, total: number) => void,
) {
  const cache = await caches.open(CACHE_NAME);
  let bytes = 0;
  let cached = 0;
  for (let chapter = 1; chapter <= totalChapters; chapter++) {
    // 元数据（含逐节时间戳）与音频文件成对缓存，离线时高亮跟随不缺席
    const metaResponse = await fetch(metaUrl(version, book, chapter, voice));
    if (metaResponse.ok) {
      const metaBytes = await metaResponse.clone().arrayBuffer();
      const fileResponse = await fetch(fileUrl(version, book, chapter, voice));
      if (fileResponse.ok) {
        const audioBytes = await fileResponse.arrayBuffer();
        bytes += audioBytes.byteLength + metaBytes.byteLength;
        await cache.put(metaUrl(version, book, chapter, voice), new Response(metaBytes, {
          headers: { "Content-Type": "application/json" },
        }));
        await cache.put(fileUrl(version, book, chapter, voice), new Response(audioBytes, {
          headers: { "Content-Type": "audio/mpeg" },
        }));
        cached += 1;
      }
    }
    // 某些章可能暂无音频（上游未生成），跳过继续，不让整卷失败
    onProgress(chapter, totalChapters);
  }
  if (cached === 0) throw new Error("这卷书暂时没有可缓存的音频");
  const meta = getOfflineAudioMeta();
  meta[audioPackKey(book, voice)] = {
    chapters: cached,
    totalChapters,
    bytes,
    at: new Date().toISOString(),
  };
  save(META_KEY, meta);
}

export async function removeBookAudio(version: string, book: string, totalChapters: number, voice: string) {
  const cache = await caches.open(CACHE_NAME);
  for (let chapter = 1; chapter <= totalChapters; chapter++) {
    await cache.delete(fileUrl(version, book, chapter, voice));
    await cache.delete(metaUrl(version, book, chapter, voice));
  }
  const meta = getOfflineAudioMeta();
  delete meta[audioPackKey(book, voice)];
  save(META_KEY, meta);
}

export function isBookAudioCached(book: string, voice: string) {
  return Boolean(getOfflineAudioMeta()[audioPackKey(book, voice)]);
}

/** 离线优先：命中缓存返回本地 blob 地址与时间戳，未命中返回 null */
export async function cachedChapterAudio(
  version: string,
  book: string,
  chapter: number,
  voice: string,
): Promise<{ audioUrl: string; timestamps: unknown; voice: string } | null> {
  if (!offlineAudioSupported()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const [file, meta] = await Promise.all([
      cache.match(fileUrl(version, book, chapter, voice)),
      cache.match(metaUrl(version, book, chapter, voice)),
    ]);
    if (!file) return null;
    const blob = await file.blob();
    let timestamps: unknown = [];
    let reportedVoice = voice;
    if (meta) {
      try {
        const parsed = await meta.json() as { timestamps?: unknown; voice?: string };
        timestamps = parsed.timestamps ?? [];
        if (parsed.voice) reportedVoice = parsed.voice;
      } catch { /* 没有时间戳也能播 */ }
    }
    return { audioUrl: URL.createObjectURL(blob), timestamps, voice: reportedVoice };
  } catch {
    return null;
  }
}
