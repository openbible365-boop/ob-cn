import path from "node:path";

export const MAX_COMMUNITY_RESOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_COMMUNITY_KNOWLEDGE_CHARS = 100_000;

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".yaml",
  ".yml",
  ".srt",
  ".vtt",
  ".log",
]);

export function communityUploadRoot() {
  return path.resolve(
    process.env.COMMUNITY_UPLOAD_DIR ??
      path.join(process.cwd(), "uploads", "community"),
  );
}

export function safeUploadName(value: string) {
  const normalized = path.basename(value).normalize("NFKC");
  const clean = normalized
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || "file").slice(0, 180);
}

export function resourceTypeForFile(fileName: string, mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "IMAGE" as const;
  if (mime.startsWith("audio/")) return "AUDIO" as const;
  if (mime.startsWith("video/")) return "VIDEO" as const;
  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
    return "TEXT" as const;
  }
  if (
    mime === "application/pdf" ||
    mime.includes("document") ||
    mime.includes("sheet") ||
    mime.includes("presentation") ||
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("powerpoint")
  ) {
    return "DOCUMENT" as const;
  }
  return "OTHER" as const;
}

export function extractPlainText(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
) {
  const type = resourceTypeForFile(fileName, mimeType);
  if (type !== "TEXT") return "";
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, MAX_COMMUNITY_KNOWLEDGE_CHARS);
}

export function resolvedStoragePath(storageKey: string) {
  const root = communityUploadRoot();
  const candidate = path.resolve(root, storageKey);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return candidate;
}
