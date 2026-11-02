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

export type QwenUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type QwenStreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; usage: QwenUsage };

export type QwenResult =
  | {
      ok: true;
      answer: string;
      usage: QwenUsage;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

function removeThinkingBlocks(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function qwenRequestConfig(input: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
}, stream: boolean) {
  return {
    model: process.env.OPENBIBLE_LLM_MODEL ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: `${input.systemPrompt}\n\n/no_think` },
      ...input.messages,
    ],
    temperature: 0.4,
    top_p: 0.85,
    max_tokens: input.maxTokens ?? 800,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    chat_template_kwargs: { enable_thinking: false },
  };
}

function normalizeUsage(usage: QwenResponse["usage"]): QwenUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens: usage?.completion_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

function qwenCredentials() {
  const apiKey = process.env.OPENBIBLE_LLM_API_KEY ?? process.env.VLLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (
    process.env.OPENBIBLE_LLM_BASE_URL ?? "http://127.0.0.1:8010/v1"
  ).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

function parseSseBlock(block: string) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
}

export type QwenStreamResult =
  | { ok: true; events: AsyncGenerator<QwenStreamEvent> }
  | { ok: false; message: string; status: number };

export async function requestQwenStream(input: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
}): Promise<QwenStreamResult> {
  const credentials = qwenCredentials();
  if (!credentials) {
    console.error("Qwen client is missing OPENBIBLE_LLM_API_KEY");
    return {
      ok: false,
      message: "慧读模型尚未完成服务配置",
      status: 503,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${credentials.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(qwenRequestConfig(input, true)),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const result = (await response.json().catch(() => null)) as QwenResponse | null;
      clearTimeout(timeout);
      console.error("Qwen streaming upstream error", {
        status: response.status,
        message: result?.error?.message,
      });
      return {
        ok: false,
        message: "慧读模型暂时不可用，请稍后再试",
        status: 502,
      };
    }

    async function* readEvents(): AsyncGenerator<QwenStreamEvent> {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const data = parseSseBlock(block);
            if (!data || data === "[DONE]") continue;
            const payload = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: QwenResponse["usage"];
            };
            const text = payload.choices?.[0]?.delta?.content;
            if (text) yield { type: "delta", text };
            if (payload.usage) {
              yield { type: "usage", usage: normalizeUsage(payload.usage) };
            }
          }

          if (done) break;
        }

        const trailing = parseSseBlock(buffer);
        if (trailing && trailing !== "[DONE]") {
          const payload = JSON.parse(trailing) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: QwenResponse["usage"];
          };
          const text = payload.choices?.[0]?.delta?.content;
          if (text) yield { type: "delta", text };
          if (payload.usage) {
            yield { type: "usage", usage: normalizeUsage(payload.usage) };
          }
        }
      } finally {
        clearTimeout(timeout);
        controller.abort();
        reader.releaseLock();
      }
    }

    return { ok: true, events: readEvents() };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        message: "模型响应超时，请稍后再试",
        status: 504,
      };
    }
    console.error("Qwen streaming request failed", error);
    return {
      ok: false,
      message: "无法连接慧读模型，请稍后再试",
      status: 502,
    };
  }
}

export async function requestQwen(input: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
}): Promise<QwenResult> {
  const credentials = qwenCredentials();
  if (!credentials) {
    console.error("Qwen client is missing OPENBIBLE_LLM_API_KEY");
    return {
      ok: false,
      message: "慧读模型尚未完成服务配置",
      status: 503,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${credentials.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(qwenRequestConfig(input, false)),
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
      usage: normalizeUsage(result?.usage),
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
