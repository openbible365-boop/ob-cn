import { Capacitor, CapacitorHttp } from "@capacitor/core";

const NATIVE_API_ORIGIN = "https://app.openbible.live";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  connectTimeout?: number;
  readTimeout?: number;
};

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

function parseNativeData<T>(data: unknown): T | null {
  if (data == null) return null;
  if (typeof data !== "string") return data as T;

  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const method = options.method ?? "GET";
  const headers = {
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: `${NATIVE_API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`,
      method,
      headers,
      data: options.body,
      connectTimeout: options.connectTimeout ?? 15_000,
      readTimeout: options.readTimeout ?? 90_000,
      responseType: "json",
    });

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: parseNativeData<T>(response.data),
    };
  }

  const response = await fetch(path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
  });

  return {
    ok: response.ok,
    status: response.status,
    data: (await response.json().catch(() => null)) as T | null,
  };
}
