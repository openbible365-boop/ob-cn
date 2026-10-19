import { appleConfigured } from "@/lib/apple";
import { googleWebClientId } from "@/lib/google-login";

export const runtime = "nodejs";

// 网页版的第三方登录配置，前端启动登录框时读一次。
//
// web-app 是静态 JS，读不到环境变量，所以由服务端在运行时下发。
// 关键在于 client ID 只有一处真相：这里返回的值，与 /api/mobile/auth/google
// 校验 ID Token 时用的 audience 是同一个函数算出来的。之前前端自己硬编码了
// 另一个 client ID，导致网页版 Google 登录必定被服务端以 401 拒绝。
export async function GET() {
  return Response.json(
    {
      // 未配置时是空串，前端据此隐藏入口，而不是渲染一个点了必然报错的按钮
      googleClientId: googleWebClientId(),
      appleEnabled: appleConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
