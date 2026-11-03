import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { Icon } from "../components/Icon";
import { useAppBack } from "../hooks/useAppBack";
import { useSettings } from "../context/SettingsContext";
import { DOWNLOAD_CHANNELS, REFERRAL_SLOGAN } from "../data/referral";

export function ReferralPage() {
  const { translate } = useSettings();
  const goBack = useAppBack("/me");
  // 本机生成二维码（不依赖外部服务），key 为渠道 id
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState("");

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

        {DOWNLOAD_CHANNELS.map((channel) => (
          <section className="card referral-channel" key={channel.id} aria-label={translate(channel.label)}>
            <h2>{translate(channel.label)}</h2>
            <p>{translate(channel.desc)}</p>
            {channel.available ? (
              <>
                {qrMap[channel.id] && (
                  <img
                    className="referral-qr"
                    src={qrMap[channel.id]}
                    alt={translate(`${channel.label}下载二维码`)}
                  />
                )}
                <div className="referral-link">{channel.url}</div>
                <div className="referral-actions">
                  <button
                    type="button"
                    className={copiedId === channel.id ? "is-copied" : ""}
                    onClick={() => void copyLink(channel.id, channel.url)}
                  >
                    <Icon name="copy" size={14} />
                    {translate(copiedId === channel.id ? "已复制" : "复制链接")}
                  </button>
                  {typeof navigator.share === "function" && (
                    <button type="button" onClick={() => void shareLink(channel.url)}>
                      <Icon name="share" size={14} />
                      {translate("分享")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="referral-coming">{translate("即将上线")}</div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
