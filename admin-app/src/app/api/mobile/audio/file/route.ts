// 章节音频下载：同域转发上游 mp3。
// 音频存在跨域 CDN 上，<a download> 对跨域链接不生效（会变成页面导航）；
// 走本路由转发并带 Content-Disposition，浏览器与 WebView 才会稳定触发下载。
import { NextResponse } from "next/server";
import {
  getAudioCacheSettings,
  readCachedAudio,
  writeCachedAudio,
} from "@/lib/audio-cache";
import { isValidAudioParams, resolveAudio } from "@/lib/audio-source";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const version = params.get("version")?.toLowerCase() ?? "";
  const book = params.get("book")?.toLowerCase() ?? "";
  const chapter = Number(params.get("chapter"));
  const voice = params.get("voice")?.toLowerCase() ?? "";
  // 文件名由客户端给（书卷显示名在客户端），限制长度并剥掉路径分隔符
  const name = (params.get("name") ?? "").replace(/[\\/:*?"<>|]/g, "").slice(0, 80);

  if (!isValidAudioParams(version, book, chapter, voice)) {
    return NextResponse.json({ ok: false, message: "音频参数无效" }, { status: 400 });
  }

  const fileName = name || `${book}-${chapter}-${voice}.mp3`;
  const respond = (bytes: Buffer | Uint8Array, fromCache: boolean) => {
    const body = new Uint8Array(bytes);
    return new Response(body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}.mp3`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
        "X-Audio-Cache": fromCache ? "hit" : "miss",
      },
    });
  };

  // 服务端磁盘缓存：整卷缓存下载会连续拉几十章，命中直接本地出，
  // 不回源 S3。后台「音频缓存」页可开关与清空。
  const { enabled: cacheEnabled } = await getAudioCacheSettings();
  if (cacheEnabled) {
    const cached = await readCachedAudio(version, book, chapter, voice);
    if (cached) return respond(cached, true);
  }

  try {
    const data = await resolveAudio(version, book, chapter, voice);
    if (!data?.audio_url) {
      return NextResponse.json({ ok: false, message: "当前章节暂无音频" }, { status: 404 });
    }

    const upstream = await fetch(data.audio_url, { signal: AbortSignal.timeout(60_000) });
    if (!upstream.ok) {
      return NextResponse.json({ ok: false, message: "音频源暂时不可用" }, { status: 502 });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (cacheEnabled) await writeCachedAudio(version, book, chapter, voice, bytes);
    return respond(bytes, false);
  } catch {
    return NextResponse.json({ ok: false, message: "下载音频超时，请稍后重试" }, { status: 504 });
  }
}
