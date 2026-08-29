import type { JSX } from "react";

// 语音圣经播放器专属的「实心圆润」图标组。
// 全站通用图标是细线风格（Icon.tsx），播放器控制键换成 filled 圆角造型——
// 与主流音乐播放器同一语言，也让播放区在页面里自成一体。
// 圆角实现：同色描边 + round join，比逐个写贝塞尔圆角省得多。
const GLYPHS: Record<string, JSX.Element> = {
  play: (
    <path d="M9.2 6c0-1.1 1.2-1.8 2.1-1.2l8.6 5.2c.9.6.9 1.9 0 2.4l-8.6 5.2c-.9.6-2.1-.1-2.1-1.2z" />
  ),
  pause: (
    <>
      <rect x="6.4" y="4.8" width="4.1" height="14.4" rx="2" />
      <rect x="13.5" y="4.8" width="4.1" height="14.4" rx="2" />
    </>
  ),
  prev: (
    <>
      <rect x="4.6" y="5" width="2.7" height="14" rx="1.35" />
      <path d="M19.4 6.9v10.2c0 1.2-1.4 2-2.4 1.3l-7.3-5.1c-.9-.6-.9-2 0-2.6l7.3-5.1c1-.7 2.4.1 2.4 1.3z" />
    </>
  ),
  next: (
    <>
      <rect x="16.7" y="5" width="2.7" height="14" rx="1.35" />
      <path d="M4.6 6.9v10.2c0 1.2 1.4 2 2.4 1.3l7.3-5.1c.9-.6.9-2 0-2.6L7 5.6c-1-.7-2.4.1-2.4 1.3z" />
    </>
  ),
  // 后退 30：逆时针开口圆弧，箭头压在弧的起点（左上）
  replay: (
    <>
      <path
        d="M7.2 6.9A7.6 7.6 0 1 0 12 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M8.9 2.9 4.3 4.6l3.5 3.4c.8.7 2-.1 1.7-1.1z" />
    </>
  ),
  // 前进 30：顺时针镜像
  forward: (
    <>
      <path
        d="M16.8 6.9A7.6 7.6 0 1 1 12 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M15.1 2.9l4.6 1.7-3.5 3.4c-.8.7-2-.1-1.7-1.1z" />
    </>
  ),
  chevron: (
    <path d="M7 9.2c-.9-1-.2-2.6 1.1-2.6h7.8c1.3 0 2 1.6 1.1 2.6l-3.9 4.5c-.6.7-1.6.7-2.2 0z" />
  ),
};

export function AudioGlyph({ name, size = 24 }: { name: keyof typeof GLYPHS & string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
      className="audio-glyph"
    >
      {GLYPHS[name]}
    </svg>
  );
}
