export const runtime = "nodejs";

// 对应网页版原 GET /api/config/voice —— 新约朗读音色，前端启动时读一次。
export async function GET() {
  return Response.json({ nt_voice: process.env.OPENBIBLE_NT_VOICE ?? "female" });
}
