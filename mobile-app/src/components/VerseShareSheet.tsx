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

function paintShareCardBackground(
  context: CanvasRenderingContext2D,
  template: ShareCardTemplateId,
): CanvasTheme {
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

async function createShareCard(data: ShareCardData, template: ShareCardTemplateId) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const theme = paintShareCardBackground(context, template);

  context.fillStyle = theme.accent;
  context.font = "700 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText("OPENBIBLE · 每日读经", 68, 82);

  context.fillStyle = theme.quote;
  context.font = "700 142px Georgia, serif";
  context.fillText("“", 55, 220);

  const textLength = data.verseText.length;
  const verseFontSize = textLength <= 80 ? 42 : textLength <= 150 ? 35 : 29;
  const lineHeight = Math.round(verseFontSize * 1.62);
  context.fillStyle = theme.ink;
  context.font = `500 ${verseFontSize}px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans KR', sans-serif`;
  const lines = wrapCanvasText(context, data.verseText, 584, textLength <= 80 ? 8 : 10);
  lines.forEach((line, index) => context.fillText(line, 68, 230 + index * lineHeight));

  const textBottom = 230 + Math.max(1, lines.length) * lineHeight;
  context.fillStyle = theme.ink;
  context.font = "800 28px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText(`— ${data.reference}`, 68, Math.min(720, textBottom + 34));
  context.fillStyle = theme.muted;
  context.font = "600 19px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText(data.versionLabel, 68, Math.min(758, textBottom + 72));

  context.strokeStyle = template === "night" ? "rgba(246,240,223,.18)" : "rgba(24,25,31,.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(68, 790);
  context.lineTo(652, 790);
  context.stroke();

  const qrDataUrl = await QRCode.toDataURL(data.shareUrl, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: template === "night" ? "#171c31" : theme.ink, light: theme.qrLight },
  });
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await qrImage.decode();
  context.drawImage(qrImage, 502, 800, 150, 150);

  context.fillStyle = theme.ink;
  context.font = "800 25px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText("扫码阅读完整经文", 68, 860);
  context.fillStyle = theme.muted;
  context.font = "500 18px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText("打开 OpenBible", 68, 898);
  context.fillText("一起读经 · 一起成长", 68, 932);

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
    createShareCard(data, selectedTemplate)
      .then((url) => { if (!cancelled) setImageUrl(url); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [data, selectedTemplate]);

  const filename = `OpenBible-${data.reference.replace(/[\\/:*?"<>|\s]/g, "-")}.png`;
  const saveImage = () => {
    if (!imageUrl) return;
    const anchor = document.createElement("a");
    anchor.href = imageUrl;
    anchor.download = filename;
    anchor.click();
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

        <div className="verse-share-preview">
          {imageUrl ? <img src={imageUrl} alt={`${data.reference}经文分享卡`} /> : (
            <div className="verse-share-loading">{error ? "图片生成失败，请重试" : "正在生成高清经文卡…"}</div>
          )}
        </div>

        <div className="verse-share-tip"><Icon name="share" size={15} /> 图片包含二维码，扫码可直接阅读对应经文</div>
        <div className="verse-share-actions">
          <button type="button" onClick={saveImage} disabled={!imageUrl}><Icon name="download" size={18} /> 保存图片</button>
          <button type="button" className="primary" onClick={shareImage} disabled={!imageUrl}><Icon name="share" size={18} /> 分享图片</button>
        </div>
      </section>
    </div>
  );
}
