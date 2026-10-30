import { apiRequest } from "./api";
import { cachedChapterAudio } from "./offline-audio";

export type AudioTimestamp = {
  verse: number;
  start: number;
  end: number;
};

export type ChapterAudio = {
  audioUrl: string;
  timestamps: AudioTimestamp[];
  voice: string;
};

type AudioApiResult = {
  ok: boolean;
  message?: string;
  audioUrl?: string;
  timestamps?: AudioTimestamp[];
  voice?: string;
};

export async function fetchChapterAudio(
  version: string,
  book: string,
  chapter: number,
  voice: string,
): Promise<ChapterAudio> {
  // 离线优先：整卷缓存过的书直接用本机 blob，不联网、不耗流量
  const cached = await cachedChapterAudio(version, book, chapter, voice);
  if (cached) {
    const timestamps = Array.isArray(cached.timestamps)
      ? (cached.timestamps as AudioTimestamp[]).filter((item) =>
          Number.isInteger(item?.verse) && Number.isFinite(item?.start) && Number.isFinite(item?.end))
      : [];
    return { audioUrl: cached.audioUrl, timestamps, voice: cached.voice };
  }

  const query = new URLSearchParams({ version, book, chapter: String(chapter), voice });
  const path = `/api/mobile/audio?${query}`;
  const response = await apiRequest<AudioApiResult>(path, {
    connectTimeout: 12_000,
    readTimeout: 15_000,
  });
  const result = response.data;

  if (!response.ok || !result?.ok || !result.audioUrl) {
    throw new Error(result?.message ?? "当前章节暂无音频");
  }
  return {
    audioUrl: result.audioUrl,
    timestamps: result.timestamps ?? [],
    voice: result.voice ?? voice,
  };
}
