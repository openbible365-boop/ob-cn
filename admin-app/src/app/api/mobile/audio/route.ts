import { NextResponse } from "next/server";

const AUDIO_API_URL =
  process.env.OPENBIBLE_AUDIO_API_URL ?? "https://www.openbible.live/api/audio/public";
const AUDIO_CDN_BASE =
  process.env.OPENBIBLE_AUDIO_CDN_BASE ?? "https://cdsaws.s3.amazonaws.com/audio/tts/doubao";

type UpstreamTimestamp = { verse: number; start: number; end: number };
type UpstreamAudio = {
  audio_url?: string;
  timestamps?: string | UpstreamTimestamp[] | null;
  voice?: string;
};

type AudioVoice = "female" | "male";

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
  const url = `${AUDIO_CDN_BASE}/${version}/${voice}/${book}/${chapter}.mp3`;
  const response = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(8_000) });
  return response.ok ? url : null;
}

function reportedVoice(data: UpstreamAudio | null): AudioVoice | null {
  const voice = data?.voice?.toLowerCase();
  if (voice === "female" || voice === "male") return voice;

  const pathVoice = data?.audio_url?.match(/\/(female|male)\//i)?.[1]?.toLowerCase();
  return pathVoice === "female" || pathVoice === "male" ? pathVoice : null;
}

async function resolveAudio(
  upstreamUrl: URL,
  version: string,
  book: string,
  chapter: number,
  requestedVoice: AudioVoice,
) {
  const requestedData = await requestAudio(upstreamUrl, requestedVoice);
  const upstreamVoice = reportedVoice(requestedData);
  if (requestedData?.audio_url && upstreamVoice === requestedVoice) return requestedData;

  // The public API can return another row's audio while switching voices. Prefer
  // the exact CDN object whenever the response does not confirm the requested voice.
  const requestedCdnUrl = await existingCdnAudio(version, book, chapter, requestedVoice);
  if (requestedCdnUrl) {
    return { audio_url: requestedCdnUrl, voice: requestedVoice, timestamps: [] };
  }
  if (requestedData?.audio_url && !upstreamVoice) return requestedData;

  const fallbackVoice: AudioVoice = requestedVoice === "female" ? "male" : "female";
  const fallbackData = await requestAudio(upstreamUrl, fallbackVoice);
  if (fallbackData?.audio_url && reportedVoice(fallbackData) !== requestedVoice) {
    return { ...fallbackData, voice: reportedVoice(fallbackData) ?? fallbackVoice };
  }

  const fallbackCdnUrl = await existingCdnAudio(version, book, chapter, fallbackVoice);
  return fallbackCdnUrl
    ? { audio_url: fallbackCdnUrl, voice: fallbackVoice, timestamps: [] }
    : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const version = params.get("version")?.toLowerCase() ?? "";
  const book = params.get("book")?.toLowerCase() ?? "";
  const chapter = Number(params.get("chapter"));
  const voice = params.get("voice")?.toLowerCase() ?? "";

  if (version !== "cuv" || !/^[1-3]?[a-z]{2,3}$/.test(book) || !Number.isInteger(chapter) || chapter < 1 || chapter > 150 || !["female", "male"].includes(voice)) {
    return NextResponse.json({ ok: false, message: "音频参数无效" }, { status: 400 });
  }

  const upstreamUrl = new URL(AUDIO_API_URL);
  upstreamUrl.search = new URLSearchParams({ version, book, chapter: String(chapter), voice }).toString();

  try {
    const data = await resolveAudio(upstreamUrl, version, book, chapter, voice as AudioVoice);
    if (!data?.audio_url) {
      return NextResponse.json({ ok: false, message: "当前章节暂无音频" }, { status: 404 });
    }

    let timestamps: UpstreamTimestamp[] = [];
    try {
      const parsed = typeof data.timestamps === "string" ? JSON.parse(data.timestamps) : data.timestamps;
      if (Array.isArray(parsed)) {
        timestamps = parsed.filter((item): item is UpstreamTimestamp =>
          Number.isInteger(item?.verse) && Number.isFinite(item?.start) && Number.isFinite(item?.end),
        );
      }
    } catch {
      // Playback still works without verse timestamps.
    }

    return NextResponse.json({
      ok: true,
      audioUrl: data.audio_url,
      timestamps,
      voice: reportedVoice(data) ?? voice,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "获取音频超时，请稍后重试" }, { status: 504 });
  }
}
