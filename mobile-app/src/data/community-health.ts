import { apiRequest } from "./api";

export type CommunityServiceState =
  | "operational"
  | "unavailable"
  | "unconfigured"
  | "unknown";

export type CommunityServiceStatus = {
  state: CommunityServiceState;
  message: string;
};

export type CommunityServiceHealth = {
  status: "operational" | "degraded";
  checkedAt: string;
  services: {
    database: CommunityServiceStatus;
    ai: CommunityServiceStatus;
    upload: CommunityServiceStatus;
  };
};

type CommunityHealthApiResult = CommunityServiceHealth & {
  ok: boolean;
  message?: string;
};

export function unavailableCommunityHealth(
  message = "暂时无法读取服务状态",
): CommunityServiceHealth {
  return {
    status: "degraded",
    checkedAt: "",
    services: {
      database: { state: "unknown", message },
      ai: { state: "unknown", message },
      upload: { state: "unknown", message },
    },
  };
}

export async function fetchCommunityServiceHealth(): Promise<
  | { ok: true; health: CommunityServiceHealth }
  | { ok: false; message: string; health: CommunityServiceHealth }
> {
  try {
    const response = await apiRequest<CommunityHealthApiResult>(
      "/api/mobile/community/health",
    );
    const result = response.data;
    if (!response.ok || !result?.ok || !result.services) {
      const message = result?.message ?? "暂时无法读取服务状态";
      return { ok: false, message, health: unavailableCommunityHealth(message) };
    }
    return {
      ok: true,
      health: {
        status: result.status,
        checkedAt: result.checkedAt,
        services: result.services,
      },
    };
  } catch {
    const message = "暂时无法读取服务状态";
    return { ok: false, message, health: unavailableCommunityHealth(message) };
  }
}
