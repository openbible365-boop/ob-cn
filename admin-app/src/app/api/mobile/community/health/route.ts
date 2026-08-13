import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communityUploadRoot } from "@/lib/community-resource-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ServiceState = "operational" | "unavailable" | "unconfigured";

type ServiceStatus = {
  state: ServiceState;
  message: string;
};

async function databaseStatus(): Promise<ServiceStatus> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { state: "operational", message: "数据库连接正常" };
  } catch {
    return { state: "unavailable", message: "数据库暂时无法连接" };
  }
}

async function uploadStatus(): Promise<ServiceStatus> {
  try {
    const root = communityUploadRoot();
    await mkdir(root, { recursive: true });
    await access(root, constants.W_OK);
    return { state: "operational", message: "文件存储可用" };
  } catch {
    return { state: "unavailable", message: "文件上传暂时不可用" };
  }
}

async function aiStatus(): Promise<ServiceStatus> {
  const apiKey = process.env.OPENBIBLE_LLM_API_KEY ?? process.env.VLLM_API_KEY;
  if (!apiKey) {
    return { state: "unconfigured", message: "AI 开放式问答尚未配置" };
  }

  const baseUrl = (
    process.env.OPENBIBLE_LLM_BASE_URL ?? "http://127.0.0.1:8010/v1"
  ).replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.ok) {
      return { state: "operational", message: "AI 开放式问答可用" };
    }
    return { state: "unavailable", message: "AI 服务暂时无法响应" };
  } catch {
    return { state: "unavailable", message: "AI 服务暂时无法连接" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const [database, ai, upload] = await Promise.all([
    databaseStatus(),
    aiStatus(),
    uploadStatus(),
  ]);
  const services = { database, ai, upload };
  const degraded = Object.values(services).some(
    ({ state }) => state !== "operational",
  );

  return NextResponse.json(
    {
      ok: true,
      status: degraded ? "degraded" : "operational",
      checkedAt: new Date().toISOString(),
      services,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
