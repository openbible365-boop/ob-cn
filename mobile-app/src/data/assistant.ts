import { apiRequest } from "./api";

export type AssistantRole = "user" | "assistant";
export type AssistantVisibility = "private" | "public";

export type AssistantHistoryMessage = {
  role: AssistantRole;
  content: string;
};

type AssistantSuccess = {
  ok: true;
  answer: string;
  action?: AssistantAction;
  effect?: AssistantEffect;
};

type AssistantFailure = {
  ok: false;
  message?: string;
};

export type AssistantResult =
  | {
      ok: true;
      answer: string;
      action?: AssistantAction;
      effect?: AssistantEffect;
    }
  | { ok: false; message: string; status?: number };

export type AssistantAction = {
  kind: "CREATE_COMMUNITY" | "REQUEST_JOIN";
  token: string;
  title: string;
  summary: string;
  confirmLabel: string;
};

export type AssistantEffect = {
  type: "COMMUNITY_CREATED" | "COMMUNITY_JOINED" | "JOIN_REQUESTED";
  community?: {
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
    tier: "OFFICIAL_FREE" | "BASIC_FREE" | "MID" | "HIGH";
    memberCount: number;
  };
  communityId?: string;
};

export async function askCommunityAssistant(input: {
  groupId: string;
  message: string;
  history: AssistantHistoryMessage[];
  visibility: AssistantVisibility;
}): Promise<AssistantResult> {
  try {
    const response = await apiRequest<AssistantSuccess | AssistantFailure>(
      "/api/mobile/community/assistant",
      {
        method: "POST",
        body: input,
      },
    );
    const result = response.data;

    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        message:
          result && "message" in result && result.message
            ? result.message
            : "平台小助手暂时不可用，请稍后再试",
        status: response.status,
      };
    }

    return {
      ok: true,
      answer: result.answer,
      action: result.action,
      effect: result.effect,
    };
  } catch {
    return {
      ok: false,
      message: "网络连接失败，请检查网络后重试",
    };
  }
}

export async function confirmCommunityAssistantAction(input: {
  groupId: string;
  confirmationToken: string;
}): Promise<AssistantResult> {
  try {
    const response = await apiRequest<AssistantSuccess | AssistantFailure>(
      "/api/mobile/community/assistant",
      {
        method: "POST",
        body: input,
      },
    );
    const result = response.data;
    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        message:
          result && "message" in result && result.message
            ? result.message
            : "操作执行失败，请重新发起",
        status: response.status,
      };
    }
    return {
      ok: true,
      answer: result.answer,
      action: result.action,
      effect: result.effect,
    };
  } catch {
    return { ok: false, message: "网络连接失败，请检查网络后重试" };
  }
}
