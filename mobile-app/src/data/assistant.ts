import { apiFormRequest, apiRequest } from "./api";

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
  result?: AssistantStructuredResult;
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
      result?: AssistantStructuredResult;
    }
  | { ok: false; message: string; status?: number };

export type AssistantAction = {
  kind:
    | "CREATE_COMMUNITY"
    | "CREATE_GROUP"
    | "INVITE_MEMBER"
    | "REQUEST_JOIN"
    | "PUBLISH_CONTENT"
    | "CREATE_EVENT";
  token: string;
  title: string;
  summary: string;
  confirmLabel: string;
};

export type AssistantEffect = {
  type:
    | "COMMUNITY_CREATED"
    | "GROUP_CREATED"
    | "COMMUNITY_JOINED"
    | "JOIN_REQUESTED"
    | "MEMBER_INVITED"
    | "CONTENT_PUBLISHED"
    | "EVENT_CREATED";
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
  postId?: string;
  eventId?: string;
  groupId?: string;
  userId?: string;
  targetTab?: "feed" | "events" | "members" | "groups";
  refresh?: boolean;
};

export type AssistantStructuredResult =
  | {
      kind: "MEMBER_LIST";
      title: string;
      items: Array<{
        id: string;
        name: string;
        role: "OWNER" | "ADMIN" | "MEMBER";
        avatarColor: string;
        avatarUrl: string | null;
      }>;
    }
  | {
      kind: "COMMUNITY_MANAGEMENT_LIST";
      title: string;
      items: Array<{
        id: string;
        name: string;
        abbreviation: string;
        avatarColor: string;
        memberCount: number;
        role: "OWNER" | "ADMIN";
      }>;
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
      result: result.result,
    };
  } catch {
    return {
      ok: false,
      message: "网络连接失败，请检查网络后重试",
    };
  }
}

export async function askCommunityAssistantWithAttachment(input: {
  groupId: string;
  message: string;
  history: AssistantHistoryMessage[];
  visibility: AssistantVisibility;
  file: File;
}): Promise<AssistantResult> {
  const form = new FormData();
  form.append("groupId", input.groupId);
  form.append("message", input.message);
  form.append("history", JSON.stringify(input.history));
  form.append("visibility", input.visibility);
  form.append("file", input.file);
  try {
    const response = await apiFormRequest<AssistantSuccess | AssistantFailure>(
      "/api/mobile/community/assistant",
      form,
    );
    const result = response.data;
    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        message:
          result && "message" in result && result.message
            ? result.message
            : `服务器返回异常（${response.status}）`,
        status: response.status,
      };
    }
    return result;
  } catch {
    return { ok: false, message: "附件发送失败，请检查网络后重试" };
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
      result: result.result,
    };
  } catch {
    return { ok: false, message: "网络连接失败，请检查网络后重试" };
  }
}
