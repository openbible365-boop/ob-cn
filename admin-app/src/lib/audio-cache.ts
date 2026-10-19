// 服务端音频缓存：/api/mobile/audio/file 转发上游 mp3 时落盘，
// 下次同章直接从本地出——App 端整卷缓存下载会连续拉几十章，
// 没有这层的话每次都要回源 S3，慢且费上游流量。
// 后台「音频缓存」页可以查看占用、开关缓存、一键清空。
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export function audioCacheRoot() {
  return path.resolve(
    process.env.AUDIO_CACHE_DIR ?? path.join(process.cwd(), "uploads", "audio-cache"),
  );
}

const SETTINGS_FILE = "settings.json";

type AudioCacheSettings = { enabled: boolean };

export async function getAudioCacheSettings(): Promise<AudioCacheSettings> {
  try {
    const raw = await readFile(path.join(audioCacheRoot(), SETTINGS_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<AudioCacheSettings>;
    return { enabled: parsed.enabled !== false };
  } catch {
    return { enabled: true };
  }
}

export async function setAudioCacheSettings(settings: AudioCacheSettings) {
  await mkdir(audioCacheRoot(), { recursive: true });
  await writeFile(
    path.join(audioCacheRoot(), SETTINGS_FILE),
    JSON.stringify(settings, null, 2),
  );
}

function entryPath(version: string, book: string, chapter: number, voice: string) {
  // 参数在路由层已用白名单校验（version=cuv、book 为 2-3 位字母、voice 枚举），
  // 这里再 resolve 防御一次路径穿越。
  const candidate = path.resolve(
    audioCacheRoot(),
    version,
    voice,
    `${book}-${chapter}.mp3`,
  );
  if (!candidate.startsWith(audioCacheRoot() + path.sep)) return null;
  return candidate;
}

export async function readCachedAudio(
  version: string,
  book: string,
  chapter: number,
  voice: string,
) {
  const file = entryPath(version, book, chapter, voice);
  if (!file) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function writeCachedAudio(
  version: string,
  book: string,
  chapter: number,
  voice: string,
  bytes: Buffer,
) {
  const file = entryPath(version, book, chapter, voice);
  if (!file) return;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  } catch {
    // 缓存写失败不影响本次响应
  }
}

export type AudioCacheStats = {
  files: number;
  bytes: number;
  byVoice: Record<string, { files: number; bytes: number }>;
};

export async function audioCacheStats(): Promise<AudioCacheStats> {
  const stats: AudioCacheStats = { files: 0, bytes: 0, byVoice: {} };
  const root = audioCacheRoot();
  async function walk(dir: string, voice: string | null) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 目录层级：<version>/<voice>/文件
        await walk(full, voice ?? (dir === root ? null : entry.name));
      } else if (entry.name.endsWith(".mp3")) {
        const info = await stat(full);
        stats.files += 1;
        stats.bytes += info.size;
        const voiceKey = voice ?? "unknown";
        stats.byVoice[voiceKey] ??= { files: 0, bytes: 0 };
        stats.byVoice[voiceKey].files += 1;
        stats.byVoice[voiceKey].bytes += info.size;
      }
    }
  }
  await walk(root, null);
  return stats;
}

export async function clearAudioCache() {
  const root = audioCacheRoot();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await rm(path.join(root, entry.name), { recursive: true, force: true });
    }
  }
}
