import { db } from "@/lib/db";

export async function logAudit(params: {
  operatorId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
}) {
  await db.auditLog.create({ data: params });
}
