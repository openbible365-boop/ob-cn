import { readFile } from "node:fs/promises";
import { connect } from "node:http2";
import { cert, getApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { importPKCS8, SignJWT } from "jose";
import { db } from "@/lib/db";

export type PushPayload = {
  title: string;
  body: string;
  path?: string;
  imageUrl?: string;
  data?: Record<string, string>;
};

type PushDelivery = {
  platform: "ANDROID" | "IOS";
  token: string;
  ok: boolean;
  messageId?: string;
  error?: string;
};

export type PushTargetDevice = {
  platform: "ANDROID" | "IOS";
  token: string;
};

let firebaseReady = false;
let apnsSigningKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;
let apnsJwt = "";
let apnsJwtCreatedAt = 0;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少服务器环境变量 ${name}`);
  return value;
}

async function getFirebaseMessaging() {
  if (!firebaseReady) {
    if (getApps().length === 0) {
      const serviceAccountPath = requiredEnv("FIREBASE_SERVICE_ACCOUNT_PATH");
      const raw = await readFile(serviceAccountPath, "utf8");
      const serviceAccount = JSON.parse(raw) as ServiceAccount;
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      getApp();
    }
    firebaseReady = true;
  }
  return getMessaging();
}

async function getApnsJwt() {
  const now = Date.now();
  if (apnsJwt && now - apnsJwtCreatedAt < 50 * 60 * 1000) return apnsJwt;

  if (!apnsSigningKey) {
    const privateKey = await readFile(requiredEnv("APNS_PRIVATE_KEY_PATH"), "utf8");
    apnsSigningKey = await importPKCS8(privateKey, "ES256");
  }

  apnsJwtCreatedAt = now;
  apnsJwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: requiredEnv("APNS_KEY_ID") })
    .setIssuer(requiredEnv("APNS_TEAM_ID"))
    .setIssuedAt(Math.floor(now / 1000))
    .sign(apnsSigningKey);
  return apnsJwt;
}

async function sendAndroid(token: string, payload: PushPayload): Promise<PushDelivery> {
  try {
    const messaging = await getFirebaseMessaging();
    const imageUrl =
      payload.imageUrl?.trim() ||
      process.env.PUSH_DEFAULT_IMAGE_URL?.trim() ||
      "https://admin.openbible.live/openbible-notification-logo.png";
    const messageId = await messaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: {
        ...(payload.data ?? {}),
        ...(payload.path ? { path: payload.path } : {}),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "openbible_general",
          sound: "default",
          icon: "ic_stat_openbible",
          color: "#E89A2C",
          imageUrl,
        },
      },
    });
    return { platform: "ANDROID", token, ok: true, messageId };
  } catch (error) {
    return {
      platform: "ANDROID",
      token,
      ok: false,
      error: error instanceof Error ? error.message : "FCM 推送失败",
    };
  }
}

async function requestApns(
  token: string,
  payload: PushPayload,
  jwt: string,
  production: boolean,
) {
  const authority = production
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  const client = connect(authority);

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
      client.once("error", reject);
      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": process.env.APNS_BUNDLE_ID?.trim() || "live.openbible.app",
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });

      let body = "";
      let status = 0;
      request.setEncoding("utf8");
      request.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
      });
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => resolve({ status, body }));
      request.on("error", reject);
      request.end(JSON.stringify({
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
        },
        ...(payload.path ? { path: payload.path } : {}),
        ...(payload.data ?? {}),
      }));
    }).finally(() => client.close());
}

async function sendIos(token: string, payload: PushPayload): Promise<PushDelivery> {
  try {
    const jwt = await getApnsJwt();
    const production = process.env.APNS_ENVIRONMENT?.trim().toLowerCase() === "production";
    let response = await requestApns(token, payload, jwt, production);

    // Xcode development installs receive sandbox tokens, while TestFlight and
    // App Store builds receive production tokens. Supporting both avoids a
    // server reconfiguration every time the user switches build type.
    if (
      response.status === 400 &&
      /BadDeviceToken|DeviceTokenNotForTopic/.test(response.body)
    ) {
      response = await requestApns(token, payload, jwt, !production);
    }

    if (response.status !== 200) {
      throw new Error(`APNs ${response.status}: ${response.body || "请求被拒绝"}`);
    }
    return { platform: "IOS", token, ok: true };
  } catch (error) {
    return {
      platform: "IOS",
      token,
      ok: false,
      error: error instanceof Error ? error.message : "APNs 推送失败",
    };
  }
}

export async function sendPushToDevices(
  devices: PushTargetDevice[],
  payload: PushPayload,
) {
  const deliveries = await Promise.all(devices.map((device) =>
    device.platform === "ANDROID"
      ? sendAndroid(device.token, payload)
      : sendIos(device.token, payload),
  ));

  const invalidTokens = deliveries
    .filter((item) =>
      !item.ok &&
      /registration-token-not-registered|Requested entity was not found|BadDeviceToken|Unregistered/i.test(item.error ?? ""),
    )
    .map((item) => item.token);

  if (invalidTokens.length) {
    await db.devicePushToken.updateMany({
      where: { token: { in: invalidTokens } },
      data: { enabled: false },
    });
  }

  return {
    attempted: deliveries.length,
    delivered: deliveries.filter((item) => item.ok).length,
    deliveries,
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const devices = await db.devicePushToken.findMany({
    where: { userId, enabled: true },
    select: { token: true, platform: true },
  });

  return sendPushToDevices(devices, payload);
}
