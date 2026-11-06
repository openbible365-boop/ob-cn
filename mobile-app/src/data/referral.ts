// 推荐朋友：下载渠道配置（上线前把占位链接换成真实地址即可）。
// 安卓与 iOS 渠道分开：安卓直发 APK / 应用商店，iOS 走 App Store。

export type DownloadChannel = {
  id: "android" | "ios";
  label: string;
  desc: string;
  /** 二维码与复制按钮共用这个链接 */
  url: string;
  /** 渠道尚未就绪时显示"即将上线"，不出二维码 */
  available: boolean;
};

export const DOWNLOAD_CHANNELS: DownloadChannel[] = [
  {
    id: "android",
    label: "安卓版",
    desc: "扫码下载安装包，或把链接发给朋友",
    url: "https://app.openbible.live/downloads/openbible-android.apk", // 与网页版下载页同一文件（downloads/README.md）
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
