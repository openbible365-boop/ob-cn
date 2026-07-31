import { apiRequest } from "./api";

export type ReadingPlanDay = {
  id: string;
  dayNumber: number;
  title: string | null;
  translation: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

export type ReadingPlan = {
  id: string;
  title: string;
  description: string | null;
  scope: "PERSONAL" | "COMMUNITY" | "PUBLIC";
  totalDays: number;
  community: { id: string; name: string; abbreviation: string } | null;
  enrolled: boolean;
  completedDays: number;
  completedAt: string | null;
  today: ReadingPlanDay | null;
};

type PlanResponse =
  | { ok: true; plans: ReadingPlan[] }
  | { ok: false; message?: string };

export async function fetchReadingPlans() {
  try {
    const response = await apiRequest<PlanResponse>("/api/mobile/reading-plans");
    if (!response.ok || !response.data?.ok) {
      return {
        ok: false as const,
        message: response.data && "message" in response.data
          ? response.data.message || "读经计划暂时无法读取"
          : "读经计划暂时无法读取",
        status: response.status,
      };
    }
    return { ok: true as const, plans: response.data.plans };
  } catch {
    return { ok: false as const, message: "网络连接失败，请稍后重试" };
  }
}

export async function updateReadingPlan(action: "ENROLL" | "COMPLETE_TODAY", planId: string) {
  try {
    const response = await apiRequest<{ ok: boolean; message?: string }>(
      "/api/mobile/reading-plans",
      { method: "POST", body: { action, planId } },
    );
    return {
      ok: response.ok && Boolean(response.data?.ok),
      message: response.data?.message || (response.ok ? "已更新" : "操作失败"),
    };
  } catch {
    return { ok: false, message: "网络连接失败，请稍后重试" };
  }
}
