// 章节音频下载：同域转发上游 mp3。
// 音频存在跨域 CDN 上，<a download> 对跨域链接不生效（会变成页面导航）；
// 走本路由转发并带 Content-Disposition，浏览器与 WebView 才会稳定触发下载。
import { NextResponse } from "next/server";
import { isValidAudioParams, resolveAudio } from "@/lib/audio-source";

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

  try {
    const data = await resolveAudio(version, book, chapter, voice);
    if (!data?.audio_url) {
      return NextResponse.json({ ok: false, message: "当前章节暂无音频" }, { status: 404 });
    }

    const upstream = await fetch(data.audio_url, { signal: AbortSignal.timeout(60_000) });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ ok: false, message: "音频源暂时不可用" }, { status: 502 });
    }

    const fileName = name || `${book}-${chapter}-${voice}.mp3`;
    const headers = new Headers({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}.mp3`,
      "Cache-Control": "no-store",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);

    return new Response(upstream.body, { headers });
  } catch {
    return NextResponse.json({ ok: false, message: "下载音频超时，请稍后重试" }, { status: 504 });
  }
}
