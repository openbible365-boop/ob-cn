import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import {
  DEFAULT_SHARE_CARD_TEMPLATE,
  type ShareCardTemplateId,
} from "@/lib/share-card-templates";

export type ShareCardSettingsValue = {
  id: "singleton";
  activeTemplate: ShareCardTemplateId;
  autoRotate: boolean;
  rotationDays: number;
  updatedAt: Date;
};

const fallbackSettings: ShareCardSettingsValue = {
  id: "singleton",
  activeTemplate: DEFAULT_SHARE_CARD_TEMPLATE,
  autoRotate: false,
  rotationDays: 7,
  updatedAt: new Date(),
};

const FALLBACK_FILE = join(tmpdir(), "ob-cn-share-card-settings.json");

const globalForShareSettings = globalThis as unknown as {
  shareCardSettingsFallback?: ShareCardSettingsValue;
};

function memorySettings() {
  globalForShareSettings.shareCardSettingsFallback ??= fallbackSettings;
  return globalForShareSettings.shareCardSettingsFallback;
}

async function readFallbackSettings(): Promise<ShareCardSettingsValue> {
  try {
    const saved = JSON.parse(await readFile(FALLBACK_FILE, "utf8")) as Omit<
      ShareCardSettingsValue,
      "updatedAt"
    > & { updatedAt: string };
    const settings = {
      ...saved,
      id: "singleton" as const,
      updatedAt: new Date(saved.updatedAt),
    };
    globalForShareSettings.shareCardSettingsFallback = settings;
    return settings;
  } catch {
    return memorySettings();
  }
}

async function writeFallbackSettings(settings: ShareCardSettingsValue) {
  globalForShareSettings.shareCardSettingsFallback = settings;
  await writeFile(
    FALLBACK_FILE,
    JSON.stringify({ ...settings, updatedAt: settings.updatedAt.toISOString() }),
    "utf8",
  );
}

export async function getShareCardSettings(): Promise<ShareCardSettingsValue> {
  if (!process.env.DATABASE_URL) return readFallbackSettings();

  try {
    const settings = await db.shareCardSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return {
      id: "singleton",
      activeTemplate: settings.activeTemplate as ShareCardTemplateId,
      autoRotate: settings.autoRotate,
      rotationDays: settings.rotationDays,
      updatedAt: settings.updatedAt,
    };
  } catch {
    return readFallbackSettings();
  }
}

export async function updateShareCardSettings(
  patch: Partial<Pick<ShareCardSettingsValue, "activeTemplate" | "autoRotate" | "rotationDays">>,
): Promise<ShareCardSettingsValue> {
  const current = await getShareCardSettings();
  const next: ShareCardSettingsValue = {
    ...current,
    ...patch,
    id: "singleton",
    updatedAt: new Date(),
  };
  await writeFallbackSettings(next);

  if (!process.env.DATABASE_URL) return next;
  try {
    const settings = await db.shareCardSettings.upsert({
      where: { id: "singleton" },
      update: patch,
      create: { id: "singleton", ...patch },
    });
    return {
      id: "singleton",
      activeTemplate: settings.activeTemplate as ShareCardTemplateId,
      autoRotate: settings.autoRotate,
      rotationDays: settings.rotationDays,
      updatedAt: settings.updatedAt,
    };
  } catch {
    return next;
  }
}
