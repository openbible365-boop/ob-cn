import { useEffect, useState } from "react";
import QRCode from "qrcode";
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

// 汉字之间垫一个空格的展示写法："智慧" → "智 慧"
function spaced(word: string) {
  return Array.from(word).join(" ");
}

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  for (const character of text) {
    const next = line + character;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line.trim());
      line = character;
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
  template: ShareCardTemplateId,
): CanvasTheme {
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
    context.fillStyle = "#8d6643";
    context.fillRect(0, 0, 14, 960);
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
    context.fillStyle = "#8f60b1";
    context.fillRect(0, 0, 12, 960);
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
    context.fillStyle = "#d9b65d";
    context.fillRect(0, 0, 12, 960);
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
  context.fillStyle = "#ffd465";
  context.fillRect(0, 0, 12, 960);
  return {
    ink: "#18191f",
    muted: "#666b76",
    accent: "#9f6fc1",
    quote: "rgba(160,108,201,.16)",
    qrLight: "#fffdf8",
  };
}

const CJK_FONT = "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";

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
  template: ShareCardTemplateId,
  theme: CanvasTheme,
  withSeal: boolean,
) {
  const darkCard = template === "night" || template === "study";
  context.strokeStyle = darkCard ? "rgba(246,240,223,.18)" : "rgba(24,25,31,.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(68, 790);
  context.lineTo(652, 790);
  context.stroke();

  const qrDataUrl = await QRCode.toDataURL(data.shareUrl, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: template === "night" ? "#171c31" : template === "study" ? "#2c1c10" : theme.ink, light: theme.qrLight },
  });
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await qrImage.decode();
  context.drawImage(qrImage, 502, 800, 150, 150);

  context.fillStyle = theme.ink;
  context.font = `800 25px ${CJK_FONT}`;
  context.fillText("扫码阅读完整经文", 68, 860);
  context.fillStyle = theme.muted;
  context.font = `500 18px ${CJK_FONT}`;
  context.fillText("慧读圣经 · 一起读经 · 一起成长", 68, 898);
  if (withSeal) paintSeal(context, 412, 812); // 印章落在文字与二维码之间的空档
}

function paintHorizontalLayout(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: CanvasTheme,
  themeWords: string[],
) {
  context.fillStyle = theme.accent;
  context.font = `700 20px ${CJK_FONT}`;
  context.fillText("慧读圣经 · 每日读经", 68, 82);
  // 日期戳靠右：分享出去的卡片自带「今天」的语境
  context.fillStyle = theme.muted;
  context.font = `600 18px ${CJK_FONT}`;
  context.textAlign = "right";
  context.fillText(todayStamp(), 652, 82);
  context.textAlign = "left";

  // 关键词题眉：主题词横排居左，字间留白 + 竖线分隔
  let verseTop = 230;
  if (themeWords.length) {
    context.fillStyle = theme.accent;
    context.font = `700 30px ${CJK_FONT}`;
    context.fillText(themeWords.map(spaced).join("  ｜  "), 68, 148);
    verseTop = 262;
  }

  context.fillStyle = theme.quote;
  context.font = "700 142px Georgia, serif";
  context.fillText("“", 55, verseTop - 10);

  const textLength = data.verseText.length;
  const verseFontSize = textLength <= 80 ? 42 : textLength <= 150 ? 35 : 29;
  const lineHeight = Math.round(verseFontSize * 1.62);
  context.fillStyle = theme.ink;
  context.font = `500 ${verseFontSize}px ${CJK_FONT}`;
  const lines = wrapCanvasText(context, data.verseText, 584, textLength <= 80 ? 7 : 9);
  lines.forEach((line, index) => context.fillText(line, 68, verseTop + index * lineHeight));

  const textBottom = verseTop + Math.max(1, lines.length) * lineHeight;
  context.fillStyle = theme.ink;
  context.font = `800 28px ${CJK_FONT}`;
  context.fillText(`— ${data.reference}`, 68, Math.min(720, textBottom + 34));
  context.fillStyle = theme.muted;
  context.font = `600 19px ${CJK_FONT}`;
  context.fillText(data.versionLabel, 68, Math.min(758, textBottom + 72));
}

// 竖排布局：经文从右往左逐列直排——中文排版的本源写法，分享卡里非常出挑
function paintVerticalLayout(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: CanvasTheme,
) {
  context.fillStyle = theme.muted;
  context.font = `600 18px ${CJK_FONT}`;
  context.fillText(todayStamp(), 68, 82);
  context.fillStyle = theme.accent;
  context.font = `700 20px ${CJK_FONT}`;
  context.textAlign = "right";
  context.fillText("慧读圣经", 652, 82);
  context.textAlign = "left";

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
  context.font = `500 ${fontSize}px ${CJK_FONT}`;
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
  template: ShareCardTemplateId,
  layout: ShareCardLayout,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const theme = paintShareCardBackground(context, template);
  if (layout === "vertical") {
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
  const [selectedTemplate, setSelectedTemplate] = useState<ShareCardTemplateId>(
    DEFAULT_SHARE_CARD_TEMPLATE,
  );
  const [layout, setLayout] = useState<ShareCardLayout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === "vertical" ? "vertical" : "horizontal";
    } catch {
      return "horizontal";
    }
  });

  useEffect(() => {
    let cancelled = false;
    fetchShareCardTemplate().then((template) => {
      if (!cancelled) setSelectedTemplate(template);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setImageUrl("");
    setError(false);
    createShareCard(data, selectedTemplate, layout)
      .then((url) => { if (!cancelled) setImageUrl(url); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [data, selectedTemplate, layout]);

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
          <button type="button" aria-label="关闭分享" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>

        <div className="verse-share-templates" role="group" aria-label="选择分享模板">
          {SHARE_CARD_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={selectedTemplate === template.id ? "active" : ""}
              aria-pressed={selectedTemplate === template.id}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <i
                aria-hidden="true"
                style={{ background: `linear-gradient(135deg, ${template.colors.join(", ")})` }}
              />
              {template.name}
            </button>
          ))}
        </div>

        <div className="verse-share-layouts" role="group" aria-label="选择排版方向">
          {([["horizontal", "横排"], ["vertical", "竖排"]] as Array<[ShareCardLayout, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={layout === value ? "active" : ""}
              aria-pressed={layout === value}
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
