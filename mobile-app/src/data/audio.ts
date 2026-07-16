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
  const query = new URLSearchParams({ version, book, chapter: String(chapter), voice });
  const response = await fetch(`/api/mobile/audio?${query}`);
  const result = (await response.json()) as AudioApiResult;
  if (!response.ok || !result.ok || !result.audioUrl) {
    throw new Error(result.message ?? "当前章节暂无音频");
  }
  return {
    audioUrl: result.audioUrl,
    timestamps: result.timestamps ?? [],
    voice: result.voice ?? voice,
  };
}
