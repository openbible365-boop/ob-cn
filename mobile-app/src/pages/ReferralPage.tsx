import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { Icon } from "../components/Icon";
import { useAppBack } from "../hooks/useAppBack";
import { useSettings } from "../context/SettingsContext";
import { DOWNLOAD_CHANNELS, REFERRAL_SLOGAN, detectDevicePlatform, type DownloadChannel } from "../data/referral";

export function ReferralPage() {
  const { translate } = useSettings();
  const goBack = useAppBack("/me");
  // 本机生成二维码（不依赖外部服务），key 为渠道 id
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState("");

  // 按本机系统排序：本机渠道在前、完整展示；另一系统收成一张小卡片，
  // 朋友用的手机和自己不一样时也找得到
  const platform = useMemo(() => detectDevicePlatform(), []);
  const [primary, secondary] = useMemo(() => {
    const own = DOWNLOAD_CHANNELS.find((channel) => channel.id === platform) ?? DOWNLOAD_CHANNELS[0];
    return [own, DOWNLOAD_CHANNELS.filter((channel) => channel.id !== own.id)];
  }, [platform]);

  useEffect(() => {
    let cancelled = false;
    for (const channel of DOWNLOAD_CHANNELS) {
      if (!channel.available) continue;
      QRCode.toDataURL(channel.url, { margin: 1, width: 440, color: { dark: "#2b2926" } })
        .then((dataUrl) => {
          if (!cancelled) setQrMap((current) => ({ ...current, [channel.id]: dataUrl }));
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);

  const copyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? "" : current)), 1800);
    } catch {
      window.alert(translate("复制失败，请长按手动复制：") + url);
    }
  };

  const shareLink = async (url: string) => {
    try {
      await navigator.share?.({ title: translate("慧读圣经"), text: translate(REFERRAL_SLOGAN), url });
    } catch {
      // 用户取消分享：无需提示
    }
  };

  const renderActions = (channel: DownloadChannel) => (
    <div className="referral-actions">
      <button
        type="button"
        className={copiedId === channel.id ? "is-copied" : ""}
        onClick={() => void copyLink(channel.id, channel.url)}
      >
        <Icon name={copiedId === channel.id ? "check" : "copy"} size={14} />
        {translate(copiedId === channel.id ? "已复制" : "复制链接")}
      </button>
      {typeof navigator.share === "function" && (
        <button type="button" onClick={() => void shareLink(channel.url)}>
          <Icon name="share" size={14} />
          {translate("分享")}
        </button>
      )}
    </div>
  );

  const renderFull = (channel: DownloadChannel, deviceTag?: string, kicker?: string) => (
    <section
      className={`card referral-channel${deviceTag ? " is-primary" : ""}`}
      key={channel.id}
      aria-label={translate(channel.label)}
    >
      {deviceTag && <span className="referral-device-tag">{deviceTag}</span>}
      {kicker && <span className="referral-compact-kicker">{kicker}</span>}
      <h2>{translate(channel.label)}</h2>
      <p>{translate(channel.desc)}</p>
      {channel.available ? (
        <>
          {qrMap[channel.id] && (
            <img className="referral-qr" src={qrMap[channel.id]} alt={translate(`${channel.label}下载二维码`)} />
          )}
          <div className="referral-link">{channel.url}</div>
          {renderActions(channel)}
          {channel.storeUrl && (
            <a className="referral-store" href={channel.storeUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="download" size={13} />
              {translate(`在 ${channel.storeLabel} 中打开`)}
            </a>
          )}
        </>
      ) : (
        <div className="referral-coming">{translate("即将上线")}</div>
      )}
    </section>
  );

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader
        ariaLabel={translate("推荐朋友")}
        title={translate("推荐朋友")}
        subtitle={translate("慧读圣经")}
        onBack={goBack}
      />
      <main className="screen-scroll referral-page">
        <p className="referral-slogan">{translate(REFERRAL_SLOGAN)}</p>

        {renderFull(primary, platform !== "other" ? translate(platform === "ios" ? "你的手机是 iPhone" : "你的手机是安卓") : undefined)}

        {secondary.map((channel) => channel.available ? (
          renderFull(channel, undefined, translate(channel.id === "ios" ? "朋友用 iPhone？" : "朋友用安卓手机？"))
        ) : (
          <section className="card referral-channel is-compact" key={channel.id} aria-label={translate(channel.label)}>
            <div className="referral-compact-text">
              <span className="referral-compact-kicker">
                {translate(channel.id === "ios" ? "朋友用 iPhone？" : "朋友用安卓手机？")}
              </span>
              <h2>{translate(channel.label)}</h2>
              <p>{translate(channel.desc)}</p>
            </div>
            <span className="referral-compact-status">{translate("即将上线")}</span>
          </section>
        ))}
      </main>
    </div>
  );
}
