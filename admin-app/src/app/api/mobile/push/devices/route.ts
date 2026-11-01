import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { lookupIpLocation, requestIp } from "@/lib/ip-location";

const PLATFORMS = new Set(["ANDROID", "IOS"]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  let token = "";
  let platform = "";
  let deviceId: string | undefined;
  let appVersion: string | undefined;
  try {
    const body = await request.json();
    token = String(body.token ?? "").trim();
    platform = String(body.platform ?? "").trim().toUpperCase();
    deviceId = String(body.deviceId ?? "").trim().slice(0, 256) || undefined;
    appVersion = String(body.appVersion ?? "").trim().slice(0, 64) || undefined;
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  if (!token || token.length > 4096 || !PLATFORMS.has(platform)) {
    return NextResponse.json({ ok: false, message: "设备推送信息无效" }, { status: 400 });
  }

  const ipAddress = requestIp(request);
  const existing = await db.devicePushToken.findUnique({
    where: { token },
    select: {
      ipAddress: true,
      country: true,
      countryCode: true,
      region: true,
      city: true,
    },
  });
  const existingLocation = existing?.ipAddress === ipAddress
    ? {
        country: existing.country,
        countryCode: existing.countryCode,
        region: existing.region,
        city: existing.city,
      }
    : null;
  const location = existingLocation ||
    (ipAddress ? await lookupIpLocation(ipAddress) : null);
  const locationData = {
    ipAddress,
    country: location?.country ?? null,
    countryCode: location?.countryCode ?? null,
    region: location?.region ?? null,
    city: location?.city ?? null,
  };

  await db.devicePushToken.upsert({
    where: { token },
    update: {
      userId: user.id,
      platform: platform as "ANDROID" | "IOS",
      deviceId,
      appVersion,
      ...locationData,
      enabled: true,
      lastSeenAt: new Date(),
    },
    create: {
      userId: user.id,
      token,
      platform: platform as "ANDROID" | "IOS",
      deviceId,
      appVersion,
      ...locationData,
    },
  });

  return NextResponse.json({ ok: true, message: "设备推送已启用" });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
  }

  let token = "";
  try {
    token = String((await request.json()).token ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ ok: false, message: "缺少设备 Token" }, { status: 400 });
  }

  await db.devicePushToken.deleteMany({ where: { userId: user.id, token } });
  return NextResponse.json({ ok: true, message: "设备推送已注销" });
}
