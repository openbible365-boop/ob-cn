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
  code?: "AI_UNAVAILABLE" | string;
};

function assistantFailureMessage(status: number, fallback?: string) {
  if (status === 401) return "请先登录后再使用社群助手";
  if (status === 403) return "当前账号没有执行此操作的权限";
  if (status === 413) return "附件过大，请选择较小的文件";
  if (fallback && !/^服务器返回异常/u.test(fallback)) return fallback;
  if (status === 503) return "AI 开放式问答暂时不可用；社群事务仍可继续办理";
  return "社群助手暂时不可用，请稍后重试";
}

export type AssistantResult =
  | {
      ok: true;
      answer: string;
      action?: AssistantAction;
      effect?: AssistantEffect;
      result?: AssistantStructuredResult;
    }
  | { ok: false; message: string; status?: number; code?: string };

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
  fields?: Array<{ label: string; value: string }>;
  expiresAt?: string;
  confirmLabel: string;
};

export type AssistantActionChanges = {
  title?: string;
  visibility?: "PUBLIC" | "MEMBERS" | "ADMINS";
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
  group?: {
    id: string;
    name: string;
    abbreviation: string;
    description: string | null;
    avatarColor: string;
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
        message: assistantFailureMessage(
          response.status,
          result && "message" in result ? result.message : undefined,
        ),
        status: response.status,
        code: result && "code" in result ? result.code : undefined,
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
        message: assistantFailureMessage(
          response.status,
          result && "message" in result ? result.message : undefined,
        ),
        status: response.status,
        code: result && "code" in result ? result.code : undefined,
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
  actionChanges?: AssistantActionChanges;
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
        message: assistantFailureMessage(
          response.status,
          result && "message" in result ? result.message : "操作执行失败，请重新发起",
        ),
        status: response.status,
        code: result && "code" in result ? result.code : undefined,
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
