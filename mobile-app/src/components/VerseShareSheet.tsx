import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  DEFAULT_SHARE_CARD_TEMPLATE,
  fetchShareCardTemplate,
  SHARE_CARD_TEMPLATES,
  type ShareCardTemplateId,
} from "../data/share-card-templates";

type ShareCardData = {
  verseText: string;
  reference: string;
  versionLabel: string;
  shareUrl: string;
};

type ShareCardLayout = "horizontal" | "vertical";
const LAYOUT_KEY = "ob.share-card-layout";

// 「自定义」不进 SHARE_CARD_TEMPLATES：那张表同时约束后台全局默认模板，
// 而自定义背景依赖本机选图，不能被设为全局默认。
type TemplateChoice = ShareCardTemplateId | "custom";

// 选图后预处理好的背景：已按卡片比例 cover 裁剪，dark 决定整套文字配色
type CustomBackground = { canvas: HTMLCanvasElement; dark: boolean; thumb: string };

// 把用户相册里的图解码成 720x960 的 cover 画布，并采样正文区亮度定明暗。
// createImageBitmap 顺带把手机照片的 EXIF 方向转正；老 WebView 退回 <img> 解码。
async function prepareCustomBackground(file: File): Promise<CustomBackground> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl = "";
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    source = image;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 960;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    const width = "naturalWidth" in source ? source.naturalWidth : source.width;
    const height = "naturalHeight" in source ? source.naturalHeight : source.height;
    const scale = Math.max(720 / width, 960 / height);
    context.drawImage(
      source,
      (720 - width * scale) / 2,
      (960 - height * scale) / 2,
      width * scale,
      height * scale,
    );

    // 只看正文落字区域的平均亮度：暗图配米白字，亮图配深墨字
    const sample = context.getImageData(68, 140, 584, 580).data;
    let luma = 0;
    let count = 0;
    for (let i = 0; i < sample.length; i += 64) {
      luma += sample[i] * 0.2126 + sample[i + 1] * 0.7152 + sample[i + 2] * 0.0722;
      count++;
    }
    const dark = luma / count < 150;

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 90;
    thumbCanvas.height = 120;
    thumbCanvas.getContext("2d")?.drawImage(canvas, 0, 0, 90, 120);
    return { canvas, dark, thumb: thumbCanvas.toDataURL("image/jpeg", 0.7) };
  } finally {
    if ("close" in source) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// 关键词题眉：从经文里自动挑出圣经常用主题词，作为卡片的视觉引子。
// 词表按长度降序匹配，避免「盼望」被「望」截胡；最多取 3 个，取不到就不显示。
const THEME_WORDS = [
  "耶和华", "救恩", "恩典", "怜悯", "盼望", "喜乐", "平安", "智慧", "聪明", "谋略",
  "信心", "祷告", "赦免", "荣耀", "圣洁", "真理", "生命", "永生", "慈爱", "公义",
  "谦卑", "忍耐", "安息", "敬畏", "福气", "应许", "拯救", "医治", "光", "爱", "信", "义",
].sort((left, right) => right.length - left.length);

function extractThemeWords(text: string): string[] {
  const found: Array<{ word: string; at: number }> = [];
  for (const word of THEME_WORDS) {
    const at = text.indexOf(word);
    if (at === -1) continue;
    // 单字词只在没有更长的词覆盖它时才收（"智慧"命中后不再收"慧"所在的"光/爱"除外场景）
    if (word.length === 1 && found.some((item) => item.word.includes(word))) continue;
    if (found.some((item) => item.word === word)) continue;
    found.push({ word, at });
  }
  return found
    .sort((left, right) => left.at - right.at)
    .slice(0, 3)
    .map((item) => item.word);
}

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  // 按排版单元断行：拉丁词（连同其后空格）整体不拆，CJK 逐字——
  // 否则英文经文（KJV/BSB）会在单词中间任意截断
  const tokens = text.match(/[A-Za-z0-9'’-]+\s*|\s+|./gu) ?? [];
  for (const token of tokens) {
    const next = line + token;
    if (context.measureText(next).width > maxWidth && line.trim()) {
      lines.push(line.trim());
      line = token.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  const consumed = lines.join("").replace(/\s/g, "").length;
  const sourceLength = text.replace(/\s/g, "").length;
  if (consumed < sourceLength && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[，。；、,.!?！？]?$/, "")}…`;
  }
  return lines;
}

type CanvasTheme = {
  ink: string;
  muted: string;
  accent: string;
  quote: string;
  qrLight: string;
};

// 书房模板的摄影质感三件套：光束、暗角、颗粒噪点
function paintStudyTexture(context: CanvasRenderingContext2D) {
  const beam = context.createRadialGradient(180, 60, 30, 180, 60, 520);
  beam.addColorStop(0, "rgba(255,214,150,.30)");
  beam.addColorStop(1, "rgba(255,214,150,0)");
  context.fillStyle = beam;
  context.fillRect(0, 0, 720, 640);

  // 底部书脊剪影：几列圆角竖块，示意书架而不抢文字
  const spines = [
    [60, 132, "#3a2311"], [130, 118, "#452a12"], [196, 140, "#331e0d"],
    [268, 112, "#4a2d15"], [332, 128, "#3a2311"], [402, 108, "#452a12"],
    [466, 136, "#31200f"], [538, 120, "#432814"], [604, 130, "#382310"],
  ] as const;
  for (const [x, height, color] of spines) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, 960 - height, 52, height, 8);
    context.fill();
  }

  const vignette = context.createRadialGradient(360, 460, 260, 360, 480, 640);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(10,5,0,.55)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, 720, 960);

  // 颗粒噪点：低幅度亮度抖动，隔行采样以控制生成耗时
  const image = context.getImageData(0, 0, 720, 960);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 8) {
    const grain = (Math.random() - 0.5) * 14;
    pixels[i] += grain;
    pixels[i + 1] += grain;
    pixels[i + 2] += grain;
  }
  context.putImageData(image, 0, 0);
}

function paintShareCardBackground(
  context: CanvasRenderingContext2D,
  template: TemplateChoice,
  custom: CustomBackground | null,
): CanvasTheme {
  if (template === "custom" && custom) {
    context.drawImage(custom.canvas, 0, 0);
    // 半透明面纱保证经文可读：整面一层，底部（页脚/二维码区）再加深一段
    const veil = custom.dark ? "12,12,16" : "255,250,240";
    context.fillStyle = `rgba(${veil},${custom.dark ? 0.42 : 0.5})`;
    context.fillRect(0, 0, 720, 960);
    const bottom = context.createLinearGradient(0, 620, 0, 960);
    bottom.addColorStop(0, `rgba(${veil},0)`);
    bottom.addColorStop(1, `rgba(${veil},.4)`);
    context.fillStyle = bottom;
    context.fillRect(0, 620, 720, 340);
    return custom.dark
      ? {
          ink: "#f6efdf",
          muted: "rgba(246,239,223,.74)",
          accent: "#f2c96d",
          quote: "rgba(246,239,223,.32)",
          qrLight: "#f6f0df",
        }
      : {
          ink: "#201c15",
          muted: "rgba(32,28,21,.68)",
          accent: "#a06a1a",
          quote: "rgba(32,28,21,.26)",
          qrLight: "#fffdf8",
        };
  }

  if (template === "study") {
    const gradient = context.createLinearGradient(0, 0, 0, 960);
    gradient.addColorStop(0, "#160d05");
    gradient.addColorStop(0.5, "#2c1c10");
    gradient.addColorStop(1, "#3a2413");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 720, 960);
    paintStudyTexture(context);
    return {
      ink: "#f4e8d4",
      muted: "#c9b394",
      accent: "#d99a4e",
      quote: "rgba(217,154,78,.22)",
      qrLight: "#f4e8d4",
    };
  }

  if (template === "paper") {
    const gradient = context.createLinearGradient(0, 0, 720, 960);
    gradient.addColorStop(0, "#f7efd9");
    gradient.addColorStop(1, "#eadbbd");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 720, 960);
    context.fillStyle = "rgba(117,85,55,.055)";
    for (let y = 0; y < 960; y += 18) context.fillRect(0, y, 720, 1);
    return {
      ink: "#28342d",
      muted: "#6d6252",
      accent: "#8d6643",
      quote: "rgba(141,102,67,.18)",
      qrLight: "#f2e7cf",
    };
  }

  if (template === "dawn") {
    const gradient = context.createLinearGradient(0, 0, 720, 960);
    gradient.addColorStop(0, "#fff1dc");
    gradient.addColorStop(0.54, "#f2d9ea");
    gradient.addColorStop(1, "#d7daef");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 720, 960);
    const glow = context.createRadialGradient(610, 80, 20, 610, 80, 250);
    glow.addColorStop(0, "rgba(255,255,255,.78)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 720, 360);
    return {
      ink: "#49345d",
      muted: "#6f6178",
      accent: "#8f60b1",
      quote: "rgba(143,96,177,.18)",
      qrLight: "#eaddec",
    };
  }

  if (template === "night") {
    const gradient = context.createLinearGradient(0, 0, 720, 960);
    gradient.addColorStop(0, "#111827");
    gradient.addColorStop(0.58, "#171c31");
    gradient.addColorStop(1, "#25213a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 720, 960);
    const glow = context.createRadialGradient(630, 90, 10, 630, 90, 260);
    glow.addColorStop(0, "rgba(124,99,176,.35)");
    glow.addColorStop(1, "rgba(124,99,176,0)");
    context.fillStyle = glow;
    context.fillRect(350, 0, 370, 420);
    return {
      ink: "#f6f0df",
      muted: "#bbb5c5",
      accent: "#d9b65d",
      quote: "rgba(217,182,93,.18)",
      qrLight: "#f6f0df",
    };
  }

  const gradient = context.createLinearGradient(0, 0, 720, 960);
  gradient.addColorStop(0, "#fffaf0");
  gradient.addColorStop(0.62, "#fffdf8");
  gradient.addColorStop(1, "#f8f1e5");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 720, 960);
  return {
    ink: "#18191f",
    muted: "#666b76",
    accent: "#c8821f",
    quote: "rgba(200,130,31,.18)",
    qrLight: "#fffdf8",
  };
}

const CJK_FONT = "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
// 经文正文用衬线（与 App 内阅读页一致）；标题、出处等保持黑体形成对比。
// Huidu Serif 是自带的思源宋体子集——安卓没有系统宋体，靠它兜底。
const SERIF_FONT = "'Songti SC', 'Huidu Serif', 'Noto Serif CJK SC', 'Source Han Serif SC', serif";

// 四角星芒：品牌「慧读」的母题，取代通用装饰
function paintSparkle(context: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const k = r * 0.22;
  context.save();
  context.translate(x, y);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, -r);
  context.quadraticCurveTo(k, -k, r, 0);
  context.quadraticCurveTo(k, k, 0, r);
  context.quadraticCurveTo(-k, k, -r, 0);
  context.quadraticCurveTo(-k, -k, 0, -r);
  context.fill();
  context.restore();
}

// 品牌 logo：书页金双页书 + 星芒金星芒，与首启引导、应用图标同一套造型的 canvas 版。
// 描边用模板的 ink 色，深色模板上自然翻成浅描边，不用单独出一版反白 logo。
const LOGO_STARS: Array<{ points: Array<[number, number]>; brand?: boolean }> = [
  { points: [[60, 9], [63.2, 15.8], [72, 19], [63.2, 22.2], [60, 31], [56.8, 22.2], [48, 19], [56.8, 15.8]], brand: true },
  { points: [[43.6, 25.6], [45.5, 30.1], [50, 32], [45.5, 33.9], [43.6, 38.4], [41.7, 33.9], [37.2, 32], [41.7, 30.1]] },
  { points: [[77.9, 23.6], [79.8, 28.1], [84.3, 30], [79.8, 31.9], [77.9, 36.4], [76, 31.9], [71.5, 30], [76, 28.1]] },
];

function paintBrandLogo(context: CanvasRenderingContext2D, theme: CanvasTheme, x: number, y: number, size: number) {
  context.save();
  context.translate(x, y);
  context.scale(size / 120, size / 120);
  for (const star of LOGO_STARS) {
    context.fillStyle = star.brand ? "#E89A2C" : theme.ink;
    context.beginPath();
    star.points.forEach(([px, py], index) => (index ? context.lineTo(px, py) : context.moveTo(px, py)));
    context.closePath();
    context.fill();
  }
  context.fillStyle = "#F2C96D";
  context.strokeStyle = theme.ink;
  context.lineJoin = "round";
  context.lineWidth = 6;
  for (const direction of [-1, 1] as const) {
    context.beginPath();
    context.moveTo(60, 53);
    context.bezierCurveTo(60 + 10 * direction, 45, 60 + 26 * direction, 45, 60 + 34 * direction, 52);
    context.lineTo(60 + 34 * direction, 88);
    context.bezierCurveTo(60 + 26 * direction, 79, 60 + 10 * direction, 79, 60, 88);
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(60, 53);
  context.lineTo(60, 88);
  context.stroke();
  context.restore();
}

// 细线内框 + 右上角星芒：代替原先各模板的左侧色条，让卡片像一页装帧过的内页
function paintFrame(context: CanvasRenderingContext2D, theme: CanvasTheme) {
  context.save();
  context.strokeStyle = theme.quote;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(26, 26, 720 - 52, 960 - 52, 22);
  context.stroke();
  context.restore();
  paintSparkle(context, 626, 74, 15, theme.accent);
  paintSparkle(context, 654, 102, 7, theme.quote);
}

// 巨型底纹字：第一个主题词的首字淡淡压在版面一角，给卡片一个「题眼」
function paintWatermark(context: CanvasRenderingContext2D, theme: CanvasTheme, word: string | undefined, x = 500, y = 640) {
  if (!word) return;
  context.save();
  context.globalAlpha = 0.55;
  context.fillStyle = theme.quote;
  context.font = `700 330px ${CJK_FONT}`;
  context.textAlign = "center";
  context.fillText(Array.from(word)[0], x, y);
  context.restore();
  context.textAlign = "left";
}

// 红色印章：中文卡片的落款传统，比一行 logo 文字更有辨识度
function paintSeal(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.translate(x, y);
  context.rotate(-0.05);
  context.fillStyle = "rgba(179,64,47,.92)";
  context.beginPath();
  context.roundRect(0, 0, 56, 56, 8);
  context.fill();
  context.fillStyle = "#fff6ec";
  context.font = `800 22px ${CJK_FONT}`;
  context.textAlign = "center";
  context.fillText("慧", 28, 25);
  context.fillText("读", 28, 49);
  context.restore();
  context.textAlign = "left";
}

// 底部公共页脚：分隔线 + 扫码引导 + 二维码
async function paintFooter(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  template: TemplateChoice,
  theme: CanvasTheme,
  withSeal: boolean,
) {
  // 二维码放进带衬底的圆角瓷片：深色模板上自然成一块亮区，浅色模板上由描边界定。
  // 内框底边在 y=934——瓷片必须完整落在框内，右侧与正文同用 68 的页边距。
  const tile = { x: 496, y: 748, size: 156 };
  context.fillStyle = theme.qrLight;
  context.strokeStyle = theme.quote;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(tile.x, tile.y, tile.size, tile.size, 18);
  context.fill();
  context.stroke();

  // 二维码库只在真正生成分享图时加载
  const { default: QRCode } = await import("qrcode");
  const qrDataUrl = await QRCode.toDataURL(data.shareUrl, {
    width: 138,
    margin: 0,
    errorCorrectionLevel: "M",
    // 瓷片永远是浅底，深色模板（含暗图自定义背景）的 ink 是浅色，码点必须另给深色
    color: {
      dark: template === "night" ? "#171c31"
        : template === "study" ? "#2c1c10"
        : template === "custom" ? "#201c15"
        : theme.ink,
      light: theme.qrLight,
    },
  });
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await qrImage.decode();
  context.drawImage(qrImage, tile.x + 13, tile.y + 13, tile.size - 26, tile.size - 26);

  // 文案块与瓷片垂直居中对齐（瓷片中心 y≈826）
  paintSparkle(context, 78, 812, 11, theme.accent);
  context.fillStyle = theme.ink;
  context.font = `600 24px ${CJK_FONT}`;
  context.fillText("扫码阅读本节经文", 102, 821);
  context.fillStyle = theme.muted;
  context.font = `500 17px ${CJK_FONT}`;
  context.fillText("慧读圣经 · 一起读经 · 一起成长", 102, 857);
  if (withSeal) paintSeal(context, 404, 798); // 印章落在文字与二维码之间的空档
}

function paintHorizontalLayout(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: CanvasTheme,
  themeWords: string[],
) {
  // 题眉：品牌 logo 领衔，右侧两行（品牌名 + 日期）
  paintBrandLogo(context, theme, 50, 30, 90);
  context.fillStyle = theme.accent;
  context.font = `700 30px ${CJK_FONT}`;
  context.fillText("慧读圣经", 142, 78);
  context.fillStyle = theme.muted;
  context.font = `500 17px ${CJK_FONT}`;
  context.fillText(todayStamp(), 142, 107);

  paintWatermark(context, theme, themeWords[0], 520, 660);

  // ── 先测量整块内容的高度，再在题眉与页脚之间垂直居中 ──
  const textLength = data.verseText.length;
  const verseFontSize = textLength <= 40 ? 52 : textLength <= 80 ? 44 : textLength <= 150 ? 36 : 30;
  const lineHeight = Math.round(verseFontSize * 1.6);
  context.font = `500 ${verseFontSize}px ${SERIF_FONT}`;
  const lines = wrapCanvasText(context, data.verseText, 584, textLength <= 80 ? 7 : 9);

  const refBlock = 96;                               // 短金线 + 出处 + 译本
  const blockHeight = lines.length * lineHeight + refBlock;
  const zoneTop = 170;
  const zoneBottom = 728; // 二维码瓷片顶在 748，正文区到此为止
  const cursor = zoneTop + Math.max(0, (zoneBottom - zoneTop - blockHeight) / 2);

  // 引号压在首行左上，作衬不作声
  context.fillStyle = theme.quote;
  context.font = "700 130px Georgia, serif";
  context.fillText("\u201c", 52, cursor + 4);

  context.fillStyle = theme.ink;
  context.font = `500 ${verseFontSize}px ${SERIF_FONT}`;
  lines.forEach((line, index) => context.fillText(line, 68, cursor + verseFontSize + index * lineHeight));

  // 出处：短金线起笔，出处为主、译本为辅
  let refY = cursor + lines.length * lineHeight + verseFontSize * 0.4 + 26;
  context.fillStyle = theme.accent;
  context.fillRect(68, refY - 10, 38, 3);
  context.fillStyle = theme.ink;
  context.font = `600 28px ${CJK_FONT}`;
  context.fillText(data.reference, 118, refY);
  context.fillStyle = theme.muted;
  context.font = `500 18px ${CJK_FONT}`;
  context.fillText(data.versionLabel, 118, refY + 32);
}

// 竖排布局：经文从右往左逐列直排——中文排版的本源写法，分享卡里非常出挑
function paintVerticalLayout(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: CanvasTheme,
) {
  // 品牌行放左上（右上留给内框的星芒），与横排同构：logo + 品牌名 + 日期
  paintBrandLogo(context, theme, 50, 30, 90);
  context.fillStyle = theme.accent;
  context.font = `700 30px ${CJK_FONT}`;
  context.fillText("慧读圣经", 142, 78);
  context.fillStyle = theme.muted;
  context.font = `500 17px ${CJK_FONT}`;
  context.fillText(todayStamp(), 142, 107);

  const characters = Array.from(data.verseText.replace(/\s+/g, ""));
  const length = characters.length;
  const fontSize = length <= 40 ? 46 : length <= 80 ? 40 : length <= 130 ? 34 : 30;
  const rowStep = Math.round(fontSize * 1.3);
  const columnStep = Math.round(fontSize * 1.65);
  const topY = 150;
  const bottomY = 730;
  const rowsPerColumn = Math.floor((bottomY - topY) / rowStep);
  const startX = 720 - 100;
  const minX = 210;

  context.fillStyle = theme.ink;
  context.font = `500 ${fontSize}px ${SERIF_FONT}`;
  context.textAlign = "center";
  let column = 0;
  let truncated = false;
  for (let i = 0; i < characters.length; i++) {
    column = Math.floor(i / rowsPerColumn);
    const x = startX - column * columnStep;
    if (x < minX) { truncated = true; break; }
    const row = i % rowsPerColumn;
    context.fillText(characters[i], x, topY + row * rowStep + fontSize);
  }
  if (truncated) {
    context.fillText("…", minX + columnStep, bottomY + fontSize - rowStep);
  }

  // 出处竖排在最左侧一列，与正文拉开一列间距
  const refX = Math.max(minX - 40, startX - (column + 1) * columnStep - 30);
  const refChars = Array.from(`${data.reference} · ${data.versionLabel}`.replace(/\s+/g, ""));
  context.fillStyle = theme.muted;
  context.font = `700 22px ${CJK_FONT}`;
  refChars.forEach((character, index) => {
    context.fillText(character, refX, 170 + index * 28);
  });
  context.textAlign = "left";
}

async function createShareCard(
  data: ShareCardData,
  template: TemplateChoice,
  layout: ShareCardLayout,
  custom: CustomBackground | null,
) {
  // canvas 不会自动触发 webfont 下载：先显式等衬线字体就绪，
  // 否则安卓上没进过阅读页就直接分享时，经文会落回黑体
  try {
    await document.fonts.load(`500 40px ${SERIF_FONT}`, data.verseText.slice(0, 1));
  } catch { /* 字体加载失败就用回退字体，不阻塞出图 */ }

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const theme = paintShareCardBackground(context, template, custom);
  paintFrame(context, theme);
  if (layout === "vertical") {
    paintWatermark(context, theme, extractThemeWords(data.verseText)[0], 230, 660);
    paintVerticalLayout(context, data, theme);
  } else {
    paintHorizontalLayout(context, data, theme, extractThemeWords(data.verseText));
  }
  await paintFooter(context, data, template, theme, layout === "vertical");

  return canvas.toDataURL("image/png", 0.96);
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const blob = await fetch(dataUrl).then((response) => response.blob());
  return new File([blob], filename, { type: "image/png" });
}

export function VerseShareSheet({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateChoice>(
    DEFAULT_SHARE_CARD_TEMPLATE,
  );
  const [customBackground, setCustomBackground] = useState<CustomBackground | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<ShareCardLayout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === "vertical" ? "vertical" : "horizontal";
    } catch {
      return "horizontal";
    }
  });

  // 用户是否已手动选过模板：远端推荐模板异步返回时不得覆盖用户的选择
  const templateTouchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchShareCardTemplate().then((template) => {
      if (!cancelled && !templateTouchedRef.current) setSelectedTemplate(template);
    });
    return () => { cancelled = true; };
  }, []);

  // 英文经文（KJV/BSB）不支持竖排：拉丁文逐字直排不可读，强制横排并禁用切换
  const verticalUnavailable = /[A-Za-z]/.test(data.verseText) && !/[一-鿿]/.test(data.verseText);
  const effectiveLayout: ShareCardLayout = verticalUnavailable ? "horizontal" : layout;

  useEffect(() => {
    let cancelled = false;
    setImageUrl("");
    setError(false);
    createShareCard(data, selectedTemplate, effectiveLayout, customBackground)
      .then((url) => { if (!cancelled) setImageUrl(url); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [data, selectedTemplate, effectiveLayout, customBackground]);

  // 自定义背景：没选过图先调相册；已有图时点击即切换，再点一次可换图
  const pickCustomImage = () => {
    if (!customBackground || selectedTemplate === "custom") {
      customInputRef.current?.click();
    } else {
      templateTouchedRef.current = true;
      setSelectedTemplate("custom");
    }
  };

  const handleCustomFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const background = await prepareCustomBackground(file);
      setCustomBackground(background);
      templateTouchedRef.current = true;
      setSelectedTemplate("custom");
    } catch {
      // 多为安卓端选到 HEIC 等 WebView 解不了的格式
      window.alert("这张图片无法读取，请换一张（建议 JPG/PNG）");
    }
  };

  const selectLayout = (next: ShareCardLayout) => {
    setLayout(next);
    try { localStorage.setItem(LAYOUT_KEY, next); } catch { /* 存不了就不记 */ }
  };

  const filename = `OpenBible-${data.reference.replace(/[\\/:*?"<>|\s]/g, "-")}.png`;
  const saveImage = () => {
    if (!imageUrl) return;
    const anchor = document.createElement("a");
    anchor.href = imageUrl;
    anchor.download = filename;
    anchor.click();
  };
  // 纯文字分享：粘贴进任何聊天框都干净可读，不挑接收端
  const shareText = async () => {
    const text = `${data.verseText}\n—— ${data.reference}（${data.versionLabel}）\n${data.shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: data.reference, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* user cancelled */
    }
  };

  const shareImage = async () => {
    if (!imageUrl) return;
    try {
      const file = await dataUrlToFile(imageUrl, filename);
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: data.reference, text: `${data.reference}｜OpenBible`, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: data.reference, text: `${data.reference}\n${data.verseText}`, url: data.shareUrl });
      } else {
        saveImage();
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="verse-share-layer" role="dialog" aria-modal="true" aria-label="分享经文图片">
      <button className="verse-share-scrim" type="button" aria-label="关闭分享" onClick={onClose} />
      <section className="verse-share-sheet">
        <div className="verse-share-heading">
          <div><small>生成分享图片</small><strong>分享经文</strong></div>
          <button data-icon-button="default" type="button" aria-label="关闭分享" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>

        <div className="verse-share-templates" role="group" aria-label="选择分享模板">
          {SHARE_CARD_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={selectedTemplate === template.id ? "active" : ""}
              aria-pressed={selectedTemplate === template.id}
              onClick={() => { templateTouchedRef.current = true; setSelectedTemplate(template.id); }}
            >
              <i
                aria-hidden="true"
                style={{ background: `linear-gradient(135deg, ${template.colors.join(", ")})` }}
              />
              {template.name}
            </button>
          ))}
          <button
            type="button"
            className={selectedTemplate === "custom" ? "active" : ""}
            aria-pressed={selectedTemplate === "custom"}
            aria-label={customBackground ? "自定义背景（再点一次可换图）" : "选择本地图片作背景"}
            onClick={pickCustomImage}
          >
            {customBackground ? (
              <i
                className="is-custom-photo"
                aria-hidden="true"
                style={{ backgroundImage: `url(${customBackground.thumb})` }}
              />
            ) : (
              <i className="is-custom-empty" aria-hidden="true">＋</i>
            )}
            自定义
          </button>
          <input
            ref={customInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleCustomFile(file);
            }}
          />
        </div>

        <div className="verse-share-layouts" role="group" aria-label="选择排版方向">
          {([["horizontal", "横排"], ["vertical", "竖排"]] as Array<[ShareCardLayout, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={effectiveLayout === value ? "active" : ""}
              aria-pressed={effectiveLayout === value}
              disabled={value === "vertical" && verticalUnavailable}
              title={value === "vertical" && verticalUnavailable ? "英文经文不支持竖排" : undefined}
              onClick={() => selectLayout(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="verse-share-preview">
          {imageUrl ? <img src={imageUrl} alt={`${data.reference}经文分享卡`} /> : (
            <div className="verse-share-loading">{error ? "图片生成失败，请重试" : "正在生成高清经文卡…"}</div>
          )}
        </div>

        <div className="verse-share-tip"><Icon name="share" size={16} /> 图片包含二维码，扫码可直接阅读对应经文</div>
        <div className="verse-share-actions is-three">
          <button type="button" onClick={shareText}><Icon name="align-justify" size={20} /> 分享文字</button>
          <button type="button" onClick={saveImage} disabled={!imageUrl}><Icon name="download" size={20} /> 保存图片</button>
          <button type="button" className="primary" onClick={shareImage} disabled={!imageUrl}><Icon name="share" size={20} /> 分享图片</button>
        </div>
      </section>
    </div>
  );
}
