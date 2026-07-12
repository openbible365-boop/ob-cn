"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";

export async function createOperator(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!username || !name) throw new Error("用户名和姓名不能为空");
  if (password.length < 8) throw new Error("密码至少 8 位");
  if (!["SUPER_ADMIN", "MODERATOR"].includes(role)) throw new Error("角色不合法");

  const passwordHash = await bcrypt.hash(password, 10);
  const operator = await db.operator.create({
    data: { username, name, passwordHash, role: role as "SUPER_ADMIN" | "MODERATOR" },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "新建运营账号",
    targetType: "Operator",
    targetId: operator.id,
    detail: `${username}（${name}）· ${role}`,
  });

  revalidatePath("/audit");
}

export async function resetOperatorPassword(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const operatorId = String(formData.get("operatorId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) throw new Error("密码至少 8 位");

  const passwordHash = await bcrypt.hash(password, 10);
  const operator = await db.operator.update({
    where: { id: operatorId },
    data: { passwordHash },
  });

  await logAudit({
    operatorId: session.user.id,
    action: "重置运营账号密码",
    targetType: "Operator",
    targetId: operator.id,
    detail: operator.username,
  });

  revalidatePath("/audit");
}
