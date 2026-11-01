import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
  type PushNotificationSchema,
  type Token,
} from "@capacitor/push-notifications";
import { apiRequest } from "./api";

const TOKEN_KEY = "ob.nativePushToken";
let listenersReady = false;
let lastError = "";

export type PushRegistrationStatus = {
  supported: boolean;
  permission: PermissionStatus["receive"] | "unsupported";
  registered: boolean;
  message: string;
};

function platform() {
  return Capacitor.getPlatform() === "ios" ? "IOS" : "ANDROID";
}

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function storedToken() {
  return localStorage.getItem(TOKEN_KEY)?.trim() || "";
}

async function registerTokenWithServer(token: string) {
  const response = await apiRequest<{ ok: boolean; message?: string }>(
    "/api/mobile/push/devices",
    {
      method: "POST",
      body: { token, platform: platform() },
      readTimeout: 20_000,
    },
  );
  return response.ok && response.data?.ok === true;
}

function openNotificationPath(notification: PushNotificationSchema) {
  const path = String(notification.data?.path ?? "").trim();
  if (!path.startsWith("/")) return;
  window.location.hash = path;
}

async function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;

  await PushNotifications.addListener("registration", (token: Token) => {
    saveToken(token.value);
    lastError = "";
    void registerTokenWithServer(token.value);
  });
  await PushNotifications.addListener("registrationError", (error) => {
    lastError = String(error.error ?? "系统推送注册失败");
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    openNotificationPath(event.notification);
  });
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  await PushNotifications.createChannel({
    id: "openbible_general",
    name: "慧读圣经通知",
    description: "每日经文、社群活动和回复提醒",
    importance: 5,
    visibility: 1,
    vibration: true,
  });
}

export async function initializePushNotifications(
  requestPermission = false,
): Promise<PushRegistrationStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      supported: false,
      permission: "unsupported",
      registered: false,
      message: "网页版本不使用系统推送",
    };
  }

  try {
    await ensureListeners();
    await ensureAndroidChannel();

    let permission = (await PushNotifications.checkPermissions()).receive;
    if (permission === "prompt" && requestPermission) {
      permission = (await PushNotifications.requestPermissions()).receive;
    }
    if (permission !== "granted") {
      return {
        supported: true,
        permission,
        registered: false,
        message: permission === "denied" ? "系统通知权限已关闭" : "尚未启用系统通知",
      };
    }

    await PushNotifications.register();
    const token = storedToken();
    if (token) await registerTokenWithServer(token);
    return {
      supported: true,
      permission,
      registered: Boolean(token),
      message: lastError || (token ? "本机推送已启用" : "正在向系统登记推送…"),
    };
  } catch (error) {
    lastError = error instanceof Error ? error.message : "系统推送初始化失败";
    return {
      supported: true,
      permission: "prompt",
      registered: false,
      message: lastError,
    };
  }
}

export async function syncStoredPushToken() {
  if (!Capacitor.isNativePlatform()) return false;
  const token = storedToken();
  return token ? registerTokenWithServer(token) : false;
}

export async function unregisterCurrentPushToken() {
  if (!Capacitor.isNativePlatform()) return;
  const token = storedToken();
  if (!token) return;
  await apiRequest("/api/mobile/push/devices", {
    method: "DELETE",
    body: { token },
    readTimeout: 10_000,
  }).catch(() => {});
}

export async function sendTestPush() {
  const response = await apiRequest<{ ok: boolean; message?: string }>(
    "/api/mobile/push/test",
    { method: "POST", readTimeout: 30_000 },
  );
  return {
    ok: response.ok && response.data?.ok === true,
    message: response.data?.message ?? `服务器返回异常（${response.status}）`,
  };
}
