import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  const result = await sendPushToUser(user.id, {
    title: "慧读圣经",
    body: "推送通知已经连接成功。",
    path: "/me/notifications",
    data: { kind: "push_test" },
  });

  if (result.attempted === 0) {
    return NextResponse.json(
      { ok: false, message: "尚未登记当前手机，请先启用系统通知" },
      { status: 409 },
    );
  }
  if (result.delivered === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "推送发送失败，请检查服务器密钥配置",
        attempted: result.attempted,
        errors: result.deliveries.map((item) => item.error).filter(Boolean),
      },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "测试通知已发送",
    attempted: result.attempted,
    delivered: result.delivered,
  });
}
