"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { FALLBACK_VERSION } from "@/lib/bible-versions";

// 圣经版本的改动会影响所有用户，只开放给超级管理员，并逐条写审计。

const PAGE = "/admin/bible-versions";
const LANGS = new Set(["zh", "ko", "en"]);

async function audit(operatorId: string, action: string, code: string, detail: string) {
  await logAudit({ operatorId, action, targetType: "BibleVersion", targetId: code, detail });
}

export async function toggleVersionEnabled(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const code = String(formData.get("code") ?? "");
  if (!code || code === FALLBACK_VERSION) return; // 和合本是兜底版本，不能下架
  const version = await db.bibleVersion.findUnique({ where: { code } });
  if (!version) return;
  const enabled = !version.enabled;
  await db.bibleVersion.update({
    where: { code },
    // 下架时一并取消「默认显示」，避免新用户默认列表里出现看不到的版本
    data: { enabled, ...(enabled ? {} : { defaultOn: false }) },
  });
  await audit(session.user.id, enabled ? "上架圣经版本" : "下架圣经版本", code, `${version.label}（${code}）`);
  revalidatePath(PAGE);
}

export async function toggleVersionDefault(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const code = String(formData.get("code") ?? "");
  if (!code || code === FALLBACK_VERSION) return; // 和合本始终默认显示
  const version = await db.bibleVersion.findUnique({ where: { code } });
  if (!version || !version.enabled) return;
  const defaultOn = !version.defaultOn;
  await db.bibleVersion.update({ where: { code }, data: { defaultOn } });
  await audit(
    session.user.id,
    defaultOn ? "设为新用户默认显示" : "取消新用户默认显示",
    code,
    `${version.label}（${code}）`,
  );
  revalidatePath(PAGE);
}

export async function moveVersion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const code = String(formData.get("code") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const all = await db.bibleVersion.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  // 只在「已上架」组内调整顺序（App 里看得到的顺序）；未上架的统一排在后面
  const isListed = (row: (typeof all)[number]) => row.enabled || row.code === FALLBACK_VERSION;
  const rows = all.filter(isListed);
  const index = rows.findIndex((row) => row.code === code);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return;
  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  reordered.push(...all.filter((row) => !isListed(row)));
  // 统一重排为 10、20、30…，避免历史数据里的重复序号
  await db.$transaction(
    reordered.map((row, position) =>
      db.bibleVersion.update({ where: { code: row.code }, data: { sortOrder: (position + 1) * 10 } }),
    ),
  );
  await audit(session.user.id, "调整圣经版本顺序", code, `${rows[index].label} ${direction < 0 ? "上移" : "下移"}`);
  revalidatePath(PAGE);
}

export async function updateVersionInfo(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const code = String(formData.get("code") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  const lang = String(formData.get("lang") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!code || !label || !LANGS.has(lang)) return;
  const before = await db.bibleVersion.findUnique({ where: { code } });
  if (!before) return;
  await db.bibleVersion.update({ where: { code }, data: { label, lang, note } });
  const changes = [
    before.label !== label ? `名称 ${before.label} → ${label}` : "",
    before.lang !== lang ? `语言 ${before.lang} → ${lang}` : "",
    before.note !== note ? "备注已更新" : "",
  ].filter(Boolean);
  if (changes.length) await audit(session.user.id, "编辑圣经版本", code, changes.join("；"));
  revalidatePath(PAGE);
}

/** 把 data/bible 里已有数据、但不在列表里的目录加入版本表（默认下架） */
export async function addVersion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim().slice(0, 40) || code.toUpperCase();
  const lang = String(formData.get("lang") ?? "");
  if (!/^[a-z0-9_-]{2,20}$/.test(code) || !LANGS.has(lang)) return;
  const last = await db.bibleVersion.findFirst({ orderBy: { sortOrder: "desc" } });
  await db.bibleVersion.upsert({
    where: { code },
    create: { code, label, lang, enabled: false, defaultOn: false, sortOrder: (last?.sortOrder ?? 0) + 10 },
    update: {},
  });
  await audit(session.user.id, "新增圣经版本", code, `${label}（${code}）· 默认下架`);
  revalidatePath(PAGE);
}
