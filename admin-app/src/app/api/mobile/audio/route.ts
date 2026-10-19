import { NextResponse } from "next/server";
import {
  isValidAudioParams,
  reportedVoice,
  resolveAudio,
  type UpstreamTimestamp,
} from "@/lib/audio-source";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const version = params.get("version")?.toLowerCase() ?? "";
  const book = params.get("book")?.toLowerCase() ?? "";
  const chapter = Number(params.get("chapter"));
  const voice = params.get("voice")?.toLowerCase() ?? "";

  if (!isValidAudioParams(version, book, chapter, voice)) {
    return NextResponse.json({ ok: false, message: "音频参数无效" }, { status: 400 });
  }

  try {
    const data = await resolveAudio(version, book, chapter, voice);
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
