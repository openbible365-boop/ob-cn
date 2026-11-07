// 慧读 AI 服务的真实配置与连通性（后台「AI 服务」页用）。
// 配置来自服务器环境变量（改动需重启后台服务）；这里只读取、不回显密钥。

const DEFAULT_LLM_MODEL = "Qwen3-14B-AWQ"; // 与 lib/qwen.ts 默认值一致
const CHECK_TIMEOUT_MS = 4000;

export type ServiceCheck = {
  name: string;
  purpose: string;
  configured: boolean;
  /** 只显示主机名，不显示路径与密钥 */
  host: string | null;
  detail: string;
  status: "ok" | "down" | "unconfigured";
  latencyMs: number | null;
  message: string;
};

function hostOf(url: string | undefined | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "（地址格式有误）";
  }
}

async function probe(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    return { reachable: true, status: response.status, latencyMs: Date.now() - started };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { reachable: false, status: 0, latencyMs: null, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

async function checkLlm(): Promise<ServiceCheck> {
  const apiKey = process.env.OPENBIBLE_LLM_API_KEY ?? process.env.VLLM_API_KEY;
  const baseUrl = (process.env.OPENBIBLE_LLM_BASE_URL ?? "http://127.0.0.1:8010/v1").replace(/\/+$/, "");
  const model = process.env.OPENBIBLE_LLM_MODEL ?? DEFAULT_LLM_MODEL;
  const base: Omit<ServiceCheck, "status" | "latencyMs" | "message"> = {
    name: "对话模型",
    purpose: "生成慧读的解经与追问回答",
    configured: Boolean(apiKey),
    host: hostOf(baseUrl),
    detail: `模型 ${model}`,
  };
  if (!apiKey) {
    return { ...base, status: "unconfigured", latencyMs: null, message: "未配置 OPENBIBLE_LLM_API_KEY，慧读无法回答" };
  }
  const result = await probe(`${baseUrl}/models`, { Authorization: `Bearer ${apiKey}` });
  if (!result.reachable) {
    return { ...base, status: "down", latencyMs: null, message: result.timedOut ? "连接超时（4 秒）" : "连接失败，服务可能未启动" };
  }
  if (result.status === 401 || result.status === 403) {
    return { ...base, status: "down", latencyMs: result.latencyMs, message: "密钥被拒绝，请检查 API Key" };
  }
  if (result.status >= 500) {
    return { ...base, status: "down", latencyMs: result.latencyMs, message: `服务异常（HTTP ${result.status}）` };
  }
  return { ...base, status: "ok", latencyMs: result.latencyMs, message: "连接正常" };
}

async function checkRag(): Promise<ServiceCheck> {
  const baseUrl = process.env.OPENBIBLE_RAG_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OPENBIBLE_RAG_INTERNAL_API_KEY;
  const base: Omit<ServiceCheck, "status" | "latencyMs" | "message"> = {
    name: "注释检索",
    purpose: "回答前检索相关经文注释作为依据",
    configured: Boolean(baseUrl && apiKey),
    host: hostOf(baseUrl),
    detail: "向量检索服务",
  };
  if (!baseUrl || !apiKey) {
    return { ...base, status: "unconfigured", latencyMs: null, message: "未配置，慧读仍能回答，但不引用注释" };
  }
  const result = await probe(baseUrl, { "X-Internal-API-Key": apiKey });
  if (!result.reachable) {
    return { ...base, status: "down", latencyMs: null, message: result.timedOut ? "连接超时（4 秒）" : "连接失败，服务可能未启动" };
  }
  if (result.status >= 500) {
    return { ...base, status: "down", latencyMs: result.latencyMs, message: `服务异常（HTTP ${result.status}）` };
  }
  return { ...base, status: "ok", latencyMs: result.latencyMs, message: "连接正常" };
}

export async function checkAiServices(): Promise<ServiceCheck[]> {
  return Promise.all([checkLlm(), checkRag()]);
}
