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
    let resolvedVoice = voice;
    let data = await requestAudio(upstreamUrl, voice);
    if (!data?.audio_url) {
      resolvedVoice = voice === "female" ? "male" : "female";
      data = await requestAudio(upstreamUrl, resolvedVoice);
    }
    if (!data?.audio_url) {
      const audioUrl = await existingCdnAudio(version, book, chapter, resolvedVoice);
      if (audioUrl) data = { audio_url: audioUrl, voice: resolvedVoice, timestamps: [] };
    }
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
      voice: data.voice ?? resolvedVoice,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "获取音频超时，请稍后重试" }, { status: 504 });
  }
}
