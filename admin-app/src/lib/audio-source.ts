// 章节音频的上游解析：从 /api/mobile/audio 路由提出来共享——
// 播放路由（返回 JSON 元数据）和下载路由（转发 mp3 文件）都要用同一套逻辑。
export const AUDIO_API_URL =
  process.env.OPENBIBLE_AUDIO_API_URL ?? "https://www.openbible.live/api/audio/public";
export const AUDIO_CDN_BASE =
  process.env.OPENBIBLE_AUDIO_CDN_BASE ?? "https://cdsaws.s3.amazonaws.com/audio/tts/doubao";

export type UpstreamTimestamp = { verse: number; start: number; end: number };
export type UpstreamAudio = {
  audio_url?: string;
  timestamps?: string | UpstreamTimestamp[] | null;
  voice?: string;
};

export type AudioVoice = "female" | "male";

export function isValidAudioParams(
  version: string,
  book: string,
  chapter: number,
  voice: string,
): voice is AudioVoice {
  return (
    version === "cuv" &&
    /^[1-3]?[a-z]{2,3}$/.test(book) &&
    Number.isInteger(chapter) &&
    chapter >= 1 &&
    chapter <= 150 &&
    ["female", "male"].includes(voice)
  );
}

async function requestAudio(upstreamUrl: URL, voice: string) {
  upstreamUrl.searchParams.set("voice", voice);
  const response = await fetch(upstreamUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  return (await response.json()) as UpstreamAudio | null;
}

async function existingCdnAudio(version: string, book: string, chapter: number, voice: string) {
  const baseUrl = `${AUDIO_CDN_BASE}/${version}/${voice}/${book}/${chapter}`;
  const [audioResponse, timestampResponse] = await Promise.all([
    fetch(`${baseUrl}.mp3`, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(8_000) }),
    fetch(`${baseUrl}.json`, { cache: "no-store", signal: AbortSignal.timeout(8_000) }),
  ]);
  if (!audioResponse.ok) return null;

  let timestamps: UpstreamTimestamp[] = [];
  if (timestampResponse.ok) {
    try {
      const data = await timestampResponse.json();
      if (Array.isArray(data)) timestamps = data;
    } catch {
      // Playback remains available if an older CDN object has no timeline.
    }
  }
  return { audio_url: `${baseUrl}.mp3`, voice, timestamps } satisfies UpstreamAudio;
}

export function reportedVoice(data: UpstreamAudio | null): AudioVoice | null {
  const voice = data?.voice?.toLowerCase();
  if (voice === "female" || voice === "male") return voice;

  const pathVoice = data?.audio_url?.match(/\/(female|male)\//i)?.[1]?.toLowerCase();
  return pathVoice === "female" || pathVoice === "male" ? pathVoice : null;
}

export async function resolveAudio(
  version: string,
  book: string,
  chapter: number,
  requestedVoice: AudioVoice,
) {
  const upstreamUrl = new URL(AUDIO_API_URL);
  upstreamUrl.search = new URLSearchParams({
    version,
    book,
    chapter: String(chapter),
    voice: requestedVoice,
  }).toString();

  const requestedData = await requestAudio(upstreamUrl, requestedVoice);
  const upstreamVoice = reportedVoice(requestedData);
  if (requestedData?.audio_url && upstreamVoice === requestedVoice) return requestedData;

  // The public API can return another row's audio while switching voices. Prefer
  // the exact CDN object whenever the response does not confirm the requested voice.
  const requestedCdnAudio = await existingCdnAudio(version, book, chapter, requestedVoice);
  if (requestedCdnAudio) return requestedCdnAudio;
  if (requestedData?.audio_url && !upstreamVoice) return requestedData;

  const fallbackVoice: AudioVoice = requestedVoice === "female" ? "male" : "female";
  const fallbackData = await requestAudio(upstreamUrl, fallbackVoice);
  if (fallbackData?.audio_url && reportedVoice(fallbackData) !== requestedVoice) {
    return { ...fallbackData, voice: reportedVoice(fallbackData) ?? fallbackVoice };
  }

  return existingCdnAudio(version, book, chapter, fallbackVoice);
}
