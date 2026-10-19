import path from "node:path";

// 头像以前是 base64 data URI 直接存库，单张约 9KB，社群工作台每次返回
// 都要把每个成员的图片数据塞进 JSON。改为落盘保存，接口只返回访问路径。
export const MAX_AVATAR_BYTES = 320 * 1024;

export const AVATAR_MIME_BY_TYPE: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
};

export function avatarUploadRoot() {
  return path.resolve(
    process.env.AVATAR_UPLOAD_DIR ??
      path.join(process.cwd(), "uploads", "avatars"),
  );
}

export function avatarExtensionFor(imageType: string) {
  return EXTENSION_BY_TYPE[imageType] ?? null;
}

export function avatarPublicPath(fileName: string) {
  return `/api/mobile/avatars/${fileName}`;
}

/** 只接受本服务生成的头像路径，返回其存储文件名。 */
export function avatarFileNameFromPublicPath(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^\/api\/mobile\/avatars\/([A-Za-z0-9._-]+)$/);
  return match?.[1] ?? null;
}

export function resolvedAvatarPath(fileName: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(fileName) || fileName.includes("..")) return null;
  const root = avatarUploadRoot();
  const candidate = path.resolve(root, fileName);
  if (!candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}
