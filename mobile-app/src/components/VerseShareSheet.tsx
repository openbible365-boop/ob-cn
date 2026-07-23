import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "./Icon";

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

async function createShareCard(data: ShareCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const gradient = context.createLinearGradient(0, 0, 720, 960);
  gradient.addColorStop(0, "#fffaf0");
  gradient.addColorStop(0.62, "#fffdf8");
  gradient.addColorStop(1, "#f8f1e5");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 720, 960);

  context.fillStyle = "#ffd465";
  context.fillRect(0, 0, 12, 960);

  context.fillStyle = "#9f6fc1";
  context.font = "700 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText("OPENBIBLE · 每日读经", 68, 82);

  context.fillStyle = "rgba(160,108,201,.16)";
  context.font = "700 142px Georgia, serif";
  context.fillText("“", 55, 220);

  const textLength = data.verseText.length;
  const verseFontSize = textLength <= 80 ? 42 : textLength <= 150 ? 35 : 29;
  const lineHeight = Math.round(verseFontSize * 1.62);
  context.fillStyle = "#18191f";
  context.font = `500 ${verseFontSize}px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans KR', sans-serif`;
  const lines = wrapCanvasText(context, data.verseText, 584, textLength <= 80 ? 8 : 10);
  lines.forEach((line, index) => context.fillText(line, 68, 230 + index * lineHeight));

  const textBottom = 230 + Math.max(1, lines.length) * lineHeight;
  context.fillStyle = "#18191f";
  context.font = "800 28px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText(`— ${data.reference}`, 68, Math.min(720, textBottom + 34));
  context.fillStyle = "#666b76";
  context.font = "600 19px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText(data.versionLabel, 68, Math.min(758, textBottom + 72));

  context.strokeStyle = "rgba(24,25,31,.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(68, 790);
  context.lineTo(652, 790);
  context.stroke();

  const qrDataUrl = await QRCode.toDataURL(data.shareUrl, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#18191f", light: "#fffdf8" },
  });
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await qrImage.decode();
  context.drawImage(qrImage, 502, 800, 150, 150);

  context.fillStyle = "#18191f";
  context.font = "800 25px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  context.fillText("扫码阅读完整经文", 68, 860);
  context.fillStyle = "#666b76";
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

  useEffect(() => {
    let cancelled = false;
    setImageUrl("");
    setError(false);
    createShareCard(data)
      .then((url) => { if (!cancelled) setImageUrl(url); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [data]);

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
