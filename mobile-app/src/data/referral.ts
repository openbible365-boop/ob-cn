// 推荐朋友：下载渠道配置。
// 安卓与 iOS 渠道分开；推荐页按本机系统把对应渠道排在最前、完整展示。
import { Capacitor } from "@capacitor/core";

export type DevicePlatform = "android" | "ios" | "other";

export type DownloadChannel = {
  id: "android" | "ios";
  label: string;
  desc: string;
  /** 二维码与复制/分享共用这个链接 */
  url: string;
  /** 商店直达链接（安卓：Google Play） */
  storeUrl?: string;
  storeLabel?: string;
  /** 渠道尚未就绪时显示「即将上线」，不出二维码 */
  available: boolean;
};

export const DOWNLOAD_CHANNELS: DownloadChannel[] = [
  {
    id: "android",
    label: "安卓版",
    desc: "朋友扫码打开下载页，可从 Google Play 安装，也可直接下载安装包",
    // 独立下载页（mobile-app/public/download）：同时提供 Google Play 与 APK
    url: "https://app.openbible.live/download",
    storeUrl: "https://play.google.com/store/apps/details?id=live.openbible.app",
    storeLabel: "Google Play",
    available: true,
  },
  {
    id: "ios",
    label: "iPhone 版",
    desc: "App Store 上架后开放下载",
    url: "https://openbible.live/download/ios", // 上线前替换：App Store 链接
    available: false,
  },
];

export const REFERRAL_SLOGAN = "把这本随身圣经分享给朋友，一起读经、一起成长。";

/** 当前设备系统：原生 App 直接问 Capacitor，网页预览时看浏览器 UA */
export function detectDevicePlatform(): DevicePlatform {
  const native = Capacitor.getPlatform();
  if (native === "android" || native === "ios") return native;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ 的 UA 伪装成 Mac：用触点数补判
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "other";
}
