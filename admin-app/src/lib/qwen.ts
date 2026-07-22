const DEFAULT_MODEL = "Qwen3-14B-AWQ";
const REQUEST_TIMEOUT_MS = 90_000;

export type QwenChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type QwenResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

export type QwenResult =
  | {
      ok: true;
      answer: string;
      usage: {
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
      };
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

function removeThinkingBlocks(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export async function requestQwen(input: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
}): Promise<QwenResult> {
  const apiKey =
    process.env.OPENBIBLE_LLM_API_KEY ?? process.env.VLLM_API_KEY;
  if (!apiKey) {
    console.error("Qwen client is missing OPENBIBLE_LLM_API_KEY");
    return {
      ok: false,
      message: "慧读模型尚未完成服务配置",
      status: 503,
    };
  }

  const baseUrl = (
    process.env.OPENBIBLE_LLM_BASE_URL ?? "http://127.0.0.1:8010/v1"
  ).replace(/\/+$/, "");
  const model = process.env.OPENBIBLE_LLM_MODEL ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${input.systemPrompt}\n\n/no_think` },
          ...input.messages,
        ],
        temperature: 0.4,
        top_p: 0.85,
        max_tokens: input.maxTokens ?? 800,
        chat_template_kwargs: { enable_thinking: false },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const result = (await response.json().catch(() => null)) as
      | QwenResponse
      | null;
    if (!response.ok) {
      console.error("Qwen upstream error", {
        status: response.status,
        message: result?.error?.message,
      });
      return {
        ok: false,
        message: "慧读模型暂时不可用，请稍后再试",
        status: 502,
      };
    }

    const answer = removeThinkingBlocks(
      result?.choices?.[0]?.message?.content ?? "",
    );
    if (!answer) {
      console.error("Qwen upstream returned an empty answer");
      return {
        ok: false,
        message: "慧读模型没有返回有效回答，请重新提问",
        status: 502,
      };
    }

    return {
      ok: true,
      answer,
      usage: {
        promptTokens: result?.usage?.prompt_tokens ?? null,
        completionTokens: result?.usage?.completion_tokens ?? null,
        totalTokens: result?.usage?.total_tokens ?? null,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        message: "模型响应超时，请稍后再试",
        status: 504,
      };
    }
    console.error("Qwen request failed", error);
    return {
      ok: false,
      message: "无法连接慧读模型，请稍后再试",
      status: 502,
    };
  } finally {
    clearTimeout(timeout);
  }
}
