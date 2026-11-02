// 慧读 conversations are persisted locally. Both opening explanations and
// follow-up questions are answered by the authenticated RAG + Qwen API and
// then stored in the same local thread.
import { Capacitor } from "@capacitor/core";
import { load, save, uid } from "./store";
import { apiFormRequest, apiRequest, resolveApiUrl } from "./api";

// 分段标签只保留语义名，配色交给样式表统一处理，避免每处各写一个色值。
export type HuiduBlock = { tag: string; text: string };
export type HuiduSource = {
  id: string;
  kind: "scripture" | "commentary" | "community";
  label: string;
  title?: string;
  bookCode?: string;
  versionCode?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  resourceId?: string;
};
export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string; blocks?: HuiduBlock[]; sources?: HuiduSource[] };
export type Conversation = {
  id: string;
  kind?: "scripture" | "general";
  bookCode?: string;
  versionCode?: string;
  chapter: number;
  verse: number;
  refLabel: string;
  verseText: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

const KEY = "ob.conversations";
const PENDING_KEY = "ob.conversationPendingOps";
// 从经文进入慧读时自动发出的首问；对话页据此以 opening 模式请求，并且不展示这条气泡
export const OPENING_QUESTION = "请为我解释这节经文";
// NOTE: 旧版回答里可能残留原始 PDF 文件名或占位词，读取时统一替换为对外展示的资料名
const LEGACY_COMMENTARY_NAME = /Cross BW jdb(?:\.pdf)?/gi;
const COMMENTARY_DISPLAY_TITLE = "《精读本注释》";
type PendingConversationOperation = { id: string; type: "upsert" | "delete"; conversationId: string };
let syncPromise: Promise<boolean> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;

function normalizeCommentaryName(value: string) {
  return value
    .replace(LEGACY_COMMENTARY_NAME, COMMENTARY_DISPLAY_TITLE)
    .replace(/真实资料名/g, COMMENTARY_DISPLAY_TITLE);
}

/**
 * 统一清洗助手消息中的资料名，并把服务端分段裁剪为本地结构（配色由样式表负责）
 * @param message 原始消息
 * @returns 清洗后的消息
 */
function normalizeMessage(message: Message): Message {
  if (message.role === "user") return message;
  return {
    ...message,
    content: message.content ? normalizeCommentaryName(message.content) : undefined,
    blocks: message.blocks?.map((block) => ({
      tag: block.tag,
      text: normalizeCommentaryName(block.text),
    })),
    sources: message.sources?.map((source) => ({
      ...source,
      label: normalizeCommentaryName(source.label),
      title: source.title ? normalizeCommentaryName(source.title) : undefined,
    })),
  };
}

export function generateBlocks(refLabel: string, verseText: string): HuiduBlock[] {
  const lines = verseText.split("\n\n").filter(Boolean);

  // 1. 生成“逐节深入解读”的内容：对每一节经文单独生成一段
  const detailedInterpretations = lines.map((line) => {
    const colonIndex = line.indexOf("节：");
    let label = "";
    let content = line;
    if (colonIndex > 0) {
      label = line.slice(0, colonIndex);
      content = line.slice(colonIndex + 2);
    }
    const snippet = content.replace(/[「」“”]/g, "").slice(0, 16);
    
    if (refLabel.includes("3:16") && label === "16") {
      return `【第 16 节解读】：“神爱世人，甚至将祂的独生子赐给他们，叫一切信祂的，不至灭亡，反得永生。”这是救赎真理的最高峰。经文层层推进：爱的源头是神，爱的对象是世人，爱的重要彰显是赐下独生爱子，而爱的得救途径是完全的信靠而非人为努力。这呼召我们全然躺平在神深沉的安全感中。`;
    }
    
    return `【第 ${label || "?"} 节解读】：“${content.slice(0, 30)}${content.length > 30 ? "…" : ""}” —— 经文聚焦在「${snippet}…」的真理上。我们要探究本节的核心原文字词，剖析其文化背景，并重点体会其在上下文中的叙事脉络与神的救赎心意。`;
  }).join("\n\n");

  const isJohn316 = refLabel.includes("3:16") && lines.length === 1;

  if (isJohn316) {
    return [
      {
        tag: "逐节深入解读",
        text: "“神爱世人，甚至将祂的独生子赐给他们，叫一切信祂的，不至灭亡，反得永生。”经文首先展现了神爱的无限范围（世人），以及祂倾其所有的无私给予（赐下独生子）。“一切信祂的”指明了救恩的普遍性与白白的应许，通过信靠而非行为，指引我们免于最终的失丧（不至灭亡），进入那永恒的、与神同在的丰盛生命（反得永生）。",
      },
      {
        tag: "神学核心和现实意义",
        text: "这节经文宣告了救恩完全由神主动并发起的爱（God's active love）。神学核心在于：神并非冷眼旁观，而是用重价完成救赎。在现实中，这带给我们绝不动摇的安全感：无论我们身处顺境还是面临现实中的重重忧虑，只要确信这深沉的爱，就能驱散恐惧，并在人际交往中活出无条件接纳与付出的爱。",
      },
      {
        tag: "总结",
        text: "约翰福音 3:16 是整本圣经福音核心的缩影。它不仅是一个神学概念，更是一份随时随地活水般的呼召，呼召我们带着感恩、凭着信心在每一天的选择中，活出蒙爱、自由的永生生命样式。",
      },
    ];
  }

  const firstLine = lines[0] || "";
  const firstLineColon = firstLine.indexOf("节：");
  const mainSnippet = (firstLineColon > 0 ? firstLine.slice(firstLineColon + 2) : firstLine)
    .replace(/[「」“”]/g, "")
    .slice(0, 16);

  return [
    {
      tag: "逐节深入解读",
      text: detailedInterpretations,
    },
    {
      tag: "神学核心和现实意义",
      text: `这段经文折射出了极其宝贵的神学核心真理（如神的恩典、主权或救赎心意），并对今天的我们提出具体的要求：在面临职场、人际关系、内心焦虑或生活抉择时，我们应当把该核心真理切实应用到现实生活中，以此更新我们的信心与日常行事为人。`,
    },
    {
      tag: "总结",
      text: `总之，这几节经文不仅是一句警醒或应许，更是一个在信仰旅程中随时的指引。建议今天以“${mainSnippet}…”这部分宝贵真理进行默想与祷告，使其切实在您的日常中发芽结实。`,
    },
  ];
}

export function clearConversationsForLogout() {
  clearTimeout(syncTimer);
  save(PENDING_KEY, []);
  save(KEY, []);
}

export function getConversations(): Conversation[] {
  return load<Conversation[]>(KEY, []).map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map(normalizeMessage),
  }));
}

function saveConversations(conversations: Conversation[]) {
  save(KEY, conversations);
}

function queueOperation(type: PendingConversationOperation["type"], conversationId: string) {
  const rest = load<PendingConversationOperation[]>(PENDING_KEY, [])
    .filter((operation) => operation.conversationId !== conversationId);
  save(PENDING_KEY, [...rest, { id: uid(), type, conversationId }]);
}

function scheduleSync() {
  if (typeof window === "undefined") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncConversations(); }, 450);
}

export function getConversation(id: string) {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function deleteConversation(id: string) {
  const remaining = getConversations().filter((conversation) => conversation.id !== id);
  saveConversations(remaining);
  queueOperation("delete", id);
  scheduleSync();
  return remaining;
}

export function hasScriptureContext(conversation: Conversation) {
  return conversation.kind !== "general" && Boolean(conversation.refLabel && conversation.verseText);
}

export function updateConversationTitle(id: string, title: string) {
  const conversations = getConversations();
  const conversation = conversations.find((item) => item.id === id);
  if (!conversation) return null;
  conversation.title = title.trim().slice(0, 40) || conversation.title;
  saveConversations(conversations);
  queueOperation("upsert", id);
  scheduleSync();
  return conversation;
}

function automaticTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/[。！？!?]/)[0]?.trim() || normalized;
  return firstSentence.length > 18 ? `${firstSentence.slice(0, 18)}…` : firstSentence;
}

export function startGeneralConversation(title: string, question: string): Conversation {
  const conv: Conversation = {
    id: uid(),
    kind: "general",
    chapter: 0,
    verse: 0,
    refLabel: "",
    verseText: "",
    title: title.trim().slice(0, 40) || automaticTitle(question) || "新的 AI 对话",
    createdAt: new Date().toISOString(),
    messages: [],
  };
  saveConversations([conv, ...getConversations()]);
  queueOperation("upsert", conv.id);
  scheduleSync();
  return conv;
}

export function startConversation(
  bookName: string,
  chapter: number,
  verse: number,
  verseText: string,
  customRefLabel?: string,
  context?: { bookCode?: string; versionCode?: string },
): Conversation {
  const refLabel = customRefLabel ?? `${bookName} ${chapter}:${verse}`;
  const conv: Conversation = {
    id: uid(),
    kind: "scripture",
    bookCode: context?.bookCode,
    versionCode: context?.versionCode,
    chapter,
    verse,
    refLabel,
    verseText,
    title: `${refLabel} 的历史背景与生活应用`,
    createdAt: new Date().toISOString(),
    // NOTE: 首次解读改由 RAG + Qwen 实时生成（对话页以 opening 模式发起），
    // 不再预置本地模板回答
    messages: [],
  };
  saveConversations([conv, ...getConversations()]);
  queueOperation("upsert", conv.id);
  scheduleSync();
  return conv;
}

export type HuiduAssistantResult =
  | { ok: true; answer: string; blocks?: HuiduBlock[]; sources: HuiduSource[] }
  | { ok: false; message: string; status?: number };

type HuiduAssistantResponse =
  | { ok: true; answer: string; blocks?: HuiduBlock[]; sources?: HuiduSource[] }
  | { ok: false; message?: string };

type HuiduStreamEvent =
  | { type: "meta"; sources?: HuiduSource[] }
  | { type: "delta"; text?: string }
  | ({ type: "done" } & Extract<HuiduAssistantResponse, { ok: true }>)
  | { type: "error"; message?: string };

export type HuiduRequestOptions = {
  file?: File | null;
  mode?: "opening" | "followup";
  onDelta?: (answer: string) => void;
};

type StreamCapableWindow = Window & {
  // NOTE: Capacitor 在打原生 HTTP 补丁之前把浏览器原始 fetch 保存在这里；
  // 与 CapacitorHttp 不同，它能拿到 response.body，才能逐段读取流式回答。
  CapacitorWebFetch?: typeof window.fetch;
};

// 首次解读要求模型按这三个标题输出，便于服务端切分；流式展示时把标题行藏掉
const HIDDEN_OPENING_HEADINGS = [
  "逐节深入解读",
  "神学核心和现实意义",
  "总结",
] as const;

// RAG 检索 + Qwen 生成的首包可能明显超过普通接口 20 秒的默认超时
const ASSISTANT_TIMEOUT_MS = 180_000;

function messageContent(message: Message) {
  if (message.role === "user") return message.content;
  if (message.content) return message.content;
  return (message.blocks ?? [])
    .map((block) => `${block.tag}：${block.text}`)
    .join("\n");
}

function visibleStreamingAnswer(value: string, hideOpeningHeadings: boolean) {
  let normalized = normalizeCommentaryName(value);
  normalized = normalized.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // 未闭合的 <think> 说明思考内容还在输出中，先截掉不展示
  const openThink = normalized.toLowerCase().lastIndexOf("<think>");
  const closeThink = normalized.toLowerCase().lastIndexOf("</think>");
  if (openThink > closeThink) normalized = normalized.slice(0, openThink);

  if (!hideOpeningHeadings) return normalized.trimStart();

  return normalized
    .split("\n")
    .filter((line) => {
      const clean = line.trim();
      if (!clean) return true;
      // 标题可能被拆成多个 delta 到达，前缀匹配也要隐藏，避免闪现半截标题
      return !HIDDEN_OPENING_HEADINGS.some((heading) => {
        const variants = [`【${heading}】`, `## ${heading}`, `### ${heading}`];
        return variants.some((variant) => (
          variant === clean || (clean.length > 0 && variant.startsWith(clean))
        ));
      });
    })
    .join("\n")
    .trimStart();
}

function assistantRequestBody(
  conversation: Conversation,
  question: string,
  mode: "opening" | "followup",
) {
  return {
    conversationId: conversation.id,
    refLabel: conversation.refLabel,
    verseText: conversation.verseText,
    bookCode: conversation.bookCode,
    versionCode: conversation.versionCode,
    chapter: conversation.chapter,
    verse: conversation.verse,
    question,
    mode,
    history: conversation.messages.map((message) => ({
      role: message.role,
      content: messageContent(message),
    })),
  };
}

function normalizeAssistantSuccess(result: Extract<HuiduAssistantResponse, { ok: true }>) {
  return {
    ok: true as const,
    answer: normalizeCommentaryName(result.answer),
    blocks: Array.isArray(result.blocks)
      ? result.blocks.map((block) => ({
          tag: block.tag,
          text: normalizeCommentaryName(block.text),
        }))
      : undefined,
    sources: Array.isArray(result.sources)
      ? result.sources.map((source) => ({
          ...source,
          label: normalizeCommentaryName(source.label),
          title: source.title ? normalizeCommentaryName(source.title) : undefined,
        }))
      : [],
  } satisfies HuiduAssistantResult;
}

async function readHuiduStream(
  response: Response,
  onDelta: (answer: string) => void,
  hideOpeningHeadings: boolean,
): Promise<HuiduAssistantResult> {
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as HuiduAssistantResponse | null;
    return {
      ok: false,
      message: result && !result.ok && result.message
        ? result.message
        : "慧读模型暂时不可用，请稍后再试",
      status: response.status,
    };
  }

  // 尚未支持流式的部署会直接返回 JSON，按普通回答处理
  if (response.headers.get("content-type")?.includes("application/json")) {
    const result = (await response.json().catch(() => null)) as HuiduAssistantResponse | null;
    if (result?.ok) return normalizeAssistantSuccess(result);
    return { ok: false, message: result?.message ?? "慧读回答未完整返回，请重新提问" };
  }

  if (!response.body) {
    return { ok: false, message: "当前设备无法接收流式回答，请稍后再试" };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let finalResult: Extract<HuiduAssistantResponse, { ok: true }> | undefined;
  let visibleTarget = "";
  let visibleLength = 0;
  let renderTimer: number | undefined;
  let renderWaiter: (() => void) | undefined;

  const renderNextSlice = () => {
    renderTimer = undefined;
    if (visibleLength < visibleTarget.length) {
      // 命中缓存或上游极快时也保持“逐字出现”的观感，典型回答额外耗时约 1 秒
      const remaining = visibleTarget.length - visibleLength;
      const step = Math.min(18, Math.max(3, Math.ceil(remaining / 24)));
      visibleLength = Math.min(visibleTarget.length, visibleLength + step);
      onDelta(visibleTarget.slice(0, visibleLength));
      renderTimer = window.setTimeout(renderNextSlice, 24);
      return;
    }
    renderWaiter?.();
    renderWaiter = undefined;
  };

  const queueVisibleAnswer = (next: string) => {
    visibleTarget = next;
    if (visibleLength > visibleTarget.length) visibleLength = visibleTarget.length;
    if (renderTimer === undefined && visibleLength < visibleTarget.length) {
      renderNextSlice();
    }
  };

  const finishVisibleAnswer = async () => {
    if (visibleLength >= visibleTarget.length) return;
    await new Promise<void>((resolve) => {
      renderWaiter = resolve;
      if (renderTimer === undefined) renderNextSlice();
    });
  };

  const handleLine = (line: string) => {
    if (!line.trim()) return undefined;
    const event = JSON.parse(line) as HuiduStreamEvent;
    if (event.type === "delta" && event.text) {
      answer += event.text;
      queueVisibleAnswer(visibleStreamingAnswer(answer, hideOpeningHeadings));
    } else if (event.type === "done") {
      finalResult = event;
    } else if (event.type === "error") {
      return event.message || "慧读回答传输中断，请稍后再试";
    }
    return undefined;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const message = handleLine(line);
        if (message) return { ok: false, message };
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const message = handleLine(buffer);
      if (message) return { ok: false, message };
    }
  } catch {
    return { ok: false, message: "慧读回答传输中断，请稍后再试" };
  } finally {
    reader.releaseLock();
  }

  if (!finalResult) {
    return { ok: false, message: "慧读回答未完整返回，请重新提问" };
  }
  queueVisibleAnswer(visibleStreamingAnswer(finalResult.answer, hideOpeningHeadings));
  await finishVisibleAnswer();
  return normalizeAssistantSuccess(finalResult);
}

async function requestStreamingAnswer(
  body: ReturnType<typeof assistantRequestBody>,
  onDelta: (answer: string) => void,
): Promise<HuiduAssistantResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);

  try {
    let response: Response;
    if (Capacitor.isNativePlatform()) {
      // NOTE: 原生端的 CapacitorHttp 不支持读取流。先用带登录态的普通请求换一张
      // 30 秒一次性票据，再用 WebView 原生 fetch 携带票据跨域拉取 NDJSON 流，
      // 这样流式请求本身不需要携带 Cookie。
      const ticketResponse = await apiRequest<
        { ok: true; ticket: string } | HuiduAssistantResponse
      >("/api/mobile/huidu/assistant", {
        method: "POST",
        headers: { "X-OpenBible-Stream-Ticket": "request" },
        readTimeout: 30_000,
        body,
      });
      const ticketResult = ticketResponse.data;
      if (!ticketResponse.ok || !ticketResult?.ok) {
        return {
          ok: false,
          message: ticketResult && !ticketResult.ok && ticketResult.message
            ? ticketResult.message
            : "无法建立慧读流式连接，请稍后再试",
          status: ticketResponse.status,
        };
      }

      // 旧版服务端不认识票据请求头，会直接返回完整回答
      if ("answer" in ticketResult) return normalizeAssistantSuccess(ticketResult);

      const webFetch = (window as StreamCapableWindow).CapacitorWebFetch
        ?? window.fetch.bind(window);
      response = await webFetch(resolveApiUrl("/api/mobile/huidu/assistant"), {
        method: "GET",
        headers: {
          Accept: "application/x-ndjson",
          "X-OpenBible-Stream-Ticket": ticketResult.ticket,
        },
        mode: "cors",
        signal: controller.signal,
      });
    } else {
      response = await fetch("/api/mobile/huidu/assistant", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    }

    return await readHuiduStream(response, onDelta, body.mode === "opening");
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.name === "AbortError"
        ? "慧读模型响应超时，请稍后再试"
        : "网络连接失败，请检查网络后重试",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * 向慧读助手提问；传入 onDelta 且没有附件时走流式输出
 * @param conversation 当前对话
 * @param question 本轮问题
 * @param options 附件、回答模式（首次解读 / 追问）与流式回调
 * @returns 回答结果
 */
export async function requestHuiduFollowup(
  conversation: Conversation,
  question: string,
  options?: HuiduRequestOptions,
): Promise<HuiduAssistantResult> {
  const mode = options?.mode ?? "followup";
  const body = assistantRequestBody(conversation, question, mode);
  // 附件需要 multipart 上传，票据流式通道不支持，仍走一次性 JSON 回答
  if (options?.onDelta && !options.file) {
    return requestStreamingAnswer(body, options.onDelta);
  }

  try {
    type AssistantReply = HuiduAssistantResponse;
    let response;
    if (options?.file) {
      // 带附件走 multipart：服务端提取纯文本并入本次提问的上下文，不落库
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
      }
      form.append("file", options.file);
      response = await apiFormRequest<AssistantReply>("/api/mobile/huidu/assistant", form, ASSISTANT_TIMEOUT_MS);
    } else {
      response = await apiRequest<AssistantReply>("/api/mobile/huidu/assistant", {
        method: "POST",
        readTimeout: ASSISTANT_TIMEOUT_MS,
        body,
      });
    }
    const result = response.data;

    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        message:
          result && "message" in result && result.message
            ? result.message
            : "慧读模型暂时不可用，请稍后再试",
        status: response.status,
      };
    }

    return normalizeAssistantSuccess(result);
  } catch {
    return {
      ok: false,
      message: "网络连接失败，请检查网络后重试",
    };
  }
}

export function appendFollowup(
  id: string,
  question: string,
  answer: string,
  sources: HuiduSource[] = [],
  blocks?: HuiduBlock[],
): Conversation | null {
  const all = getConversations();
  const conv = all.find((c) => c.id === id);
  if (!conv) return null;
  if (conv.title === "新的 AI 对话" && conv.messages.length === 0) {
    conv.title = automaticTitle(question) || conv.title;
  }
  conv.messages = [
    ...conv.messages,
    { role: "user", content: question },
    // 首次解读成功切分为三段时按分段卡片展示，否则保留整段文本
    {
      role: "assistant",
      content: blocks?.length ? undefined : answer,
      blocks: blocks?.length ? blocks : undefined,
      sources,
    },
  ];
  saveConversations(all);
  queueOperation("upsert", id);
  scheduleSync();
  return conv;
}

export function syncConversations(): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const operations = load<PendingConversationOperation[]>(PENDING_KEY, []);
    const sentIds = new Set(operations.map((operation) => operation.id));
    try {
      const response = await apiRequest<{ conversations?: Conversation[] }>(
        "/api/mobile/huidu/conversations",
        {
          method: "POST",
          body: {
            conversations: getConversations(),
            deletions: operations
              .filter((operation) => operation.type === "delete")
              .map((operation) => operation.conversationId),
          },
        },
      );
      if (
        response.status === 401 ||
        !response.ok ||
        !Array.isArray(response.data?.conversations)
      ) return false;

      const remaining = load<PendingConversationOperation[]>(PENDING_KEY, [])
        .filter((operation) => !sentIds.has(operation.id));
      save(PENDING_KEY, remaining);
      let merged = response.data.conversations.map((conversation) => ({
        ...conversation,
        createdAt: String(conversation.createdAt),
      }));
      for (const operation of remaining) {
        if (operation.type === "delete") {
          merged = merged.filter((conversation) => conversation.id !== operation.conversationId);
          continue;
        }
        const local = getConversations().find(
          (conversation) => conversation.id === operation.conversationId,
        );
        if (local) {
          merged = [local, ...merged.filter((conversation) => conversation.id !== local.id)];
        }
      }
      saveConversations(merged);
      if (remaining.length) scheduleSync();
      return true;
    } catch {
      return false;
    }
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}
