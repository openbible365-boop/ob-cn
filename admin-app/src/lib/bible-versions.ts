import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

// 圣经版本：后台可上架/下架、改显示名、排序、设新用户默认显示。
// App 启动时通过 /api/mobile/bible/versions 拉取；拉不到时用安装包里的 manifest.json。
// 经文文件都随 App 打包（data/bible/<目录>/），所以上架一个已有数据的版本不需要发新版。

export type BibleLang = "zh" | "ko" | "en";

export const LANG_LABEL: Record<string, string> = { zh: "中文", ko: "韩文 / 朝鲜文", en: "英文" };

// 首次打开后台时写入的初始清单：与当前 App 内置清单一致（前 5 个上架），
// 其余是仓库里已有经文数据、但 App 尚未开放的版本（默认下架）。
const SEED: { code: string; label: string; lang: BibleLang; enabled: boolean; defaultOn: boolean }[] = [
  { code: "cuv", label: "和合本", lang: "zh", enabled: true, defaultOn: true },
  { code: "cnvs", label: "新译本", lang: "zh", enabled: true, defaultOn: false },
  { code: "pinyin", label: "拼音和合本", lang: "zh", enabled: true, defaultOn: false },
  { code: "kjv", label: "KJV 钦定本", lang: "en", enabled: true, defaultOn: false },
  { code: "bsb", label: "BSB 标准本", lang: "en", enabled: true, defaultOn: false },
  { code: "krv", label: "개역한글", lang: "ko", enabled: false, defaultOn: false },
  { code: "snr", label: "새번역", lang: "ko", enabled: false, defaultOn: false },
  { code: "keb", label: "쉬운성경", lang: "ko", enabled: false, defaultOn: false },
  { code: "nkv", label: "조선어성경", lang: "ko", enabled: false, defaultOn: false },
];

/** 和合本是兜底版本：不能下架、始终默认显示 */
export const FALLBACK_VERSION = "cuv";

/** 版本代码 → 数据目录（拼音版读 pinyin2，与 App 端 loadBook 一致） */
export function dataFolder(code: string) {
  return code === "pinyin" ? "pinyin2" : code;
}

const DATA_ROOT = path.join(process.cwd(), "..", "data", "bible");
// pinyin2 由拼音和合本使用；pinyin 是被 pinyin2 取代的旧版拼音数据，不单独列出
const DATA_ALIAS_FOLDERS = new Set(["pinyin", "pinyin2"]);

/** 表为空时写入初始清单（幂等） */
export async function ensureBibleVersions() {
  const count = await db.bibleVersion.count();
  if (count > 0) return;
  await db.bibleVersion.createMany({
    data: SEED.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 })),
    skipDuplicates: true,
  });
}

/** 客户端用的版本清单：只含上架版本，按排序；和合本无论如何都在 */
export async function listPublicVersions() {
  await ensureBibleVersions();
  const rows = await db.bibleVersion.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  return rows
    .filter((row) => row.enabled || row.code === FALLBACK_VERSION)
    .map((row) => ({
      code: row.code,
      label: row.label,
      lang: row.lang as BibleLang,
      defaultOn: row.defaultOn || row.code === FALLBACK_VERSION,
    }));
}

export type DataInventory = { books: number; bytes: number };

/** 每个数据目录的书卷数与体积（用来提示「数据不完整的版本别上架」） */
export async function readDataInventory(): Promise<Map<string, DataInventory>> {
  const result = new Map<string, DataInventory>();
  let folders: string[] = [];
  try {
    folders = (await fs.readdir(DATA_ROOT, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return result;
  }
  await Promise.all(
    folders.map(async (folder) => {
      try {
        const files = (await fs.readdir(path.join(DATA_ROOT, folder))).filter((file) => file.endsWith(".json"));
        const sizes = await Promise.all(files.map((file) => fs.stat(path.join(DATA_ROOT, folder, file)).then((s) => s.size)));
        result.set(folder, { books: files.length, bytes: sizes.reduce((sum, size) => sum + size, 0) });
      } catch {
        // 读不了的目录当作没有数据
      }
    }),
  );
  return result;
}

/** 有经文数据、但还不在版本表里的目录（可在后台一键加入） */
export function untrackedFolders(inventory: Map<string, DataInventory>, codes: string[]) {
  const trackedFolders = new Set(codes.map(dataFolder));
  return [...inventory.keys()]
    .filter((folder) => !trackedFolders.has(folder) && !DATA_ALIAS_FOLDERS.has(folder))
    .sort();
}
