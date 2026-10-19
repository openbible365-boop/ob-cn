import { db } from "@/lib/db";

export const runtime = "nodejs";

// 对应网页版原 GET /api/support-plans/public。
// 按当前阶段约定：目录可维护展示，但不接通真实扣费。
export async function GET() {
  const plans = await db.supportPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return Response.json(
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      name_en: plan.nameEn,
      name_ko: plan.nameKo,
      price_monthly: plan.priceMonthly,
      price_once: plan.priceOnce,
      badge: plan.badge,
      badge_en: plan.badgeEn,
      badge_ko: plan.badgeKo,
      features: plan.features,
      features_en: plan.featuresEn,
      features_ko: plan.featuresKo,
      dialogue_limit: plan.dialogueLimit,
      sort_order: plan.sortOrder,
    })),
  );
}
