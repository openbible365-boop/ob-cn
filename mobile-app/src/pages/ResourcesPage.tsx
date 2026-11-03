import { useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { useArmedConfirm } from "../hooks/useArmedConfirm";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import {
  JINGDU_KEY,
  downloadCommentary,
  downloadVersion,
  getOfflineMeta,
  offlineSupported,
  readableBytes,
  removeCommentary,
  removeVersion,
} from "../data/offline-bible";
import {
  getOfflineAudioMeta,
  removeBookAudio,
} from "../data/offline-audio";
import {
  VERSIONS,
  getBookByCode,
  getVersion,
  bookName,
  getEnabledVersionCodes,
  setVersionEnabled,
} from "../data/scripture";

type Progress = { done: number; total: number };

export function ResourcesPage() {
  const goBack = useAppBack("/me/account");
  // 删除走页内二次确认（再点一次），不用 WebView 的英文 confirm 弹窗
  const { armedKey, confirm } = useArmedConfirm();
  const [meta, setMeta] = useState(getOfflineMeta);
  const [audioMeta, setAudioMeta] = useState(getOfflineAudioMeta);
  // 同一时刻只允许一个译本在下载：拼音和合本有 50MB，上并发只会互相拖慢
  const [busyVersion, setBusyVersion] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  // 勾选的译本才出现在阅读页的译本列表；和合本是兜底，不可取消
  const [enabledCodes, setEnabledCodes] = useState(getEnabledVersionCodes);
  const supported = offlineSupported();

  // 开关合一：启用即自动缓存离线包（失败不影响启用，在线仍可读）；
  // 停用即清离线缓存释放空间（数据随时可重新下载，无需二次确认）
  const toggleVersion = async (code: string) => {
    const enabling = !enabledCodes.includes(code);
    setVersionEnabled(code, enabling);
    setEnabledCodes(getEnabledVersionCodes());
    setError("");
    if (enabling) {
      if (!meta[code] && supported && !busyVersion) {
        setBusyVersion(code);
        setProgress({ done: 0, total: 66 });
        try {
          await downloadVersion(code, (done, total) => setProgress({ done, total }));
          setMeta(getOfflineMeta());
        } catch {
          setError("离线包下载失败：译本已启用，可联网阅读，稍后可重新开关重试下载");
        } finally {
          setBusyVersion("");
          setProgress(null);
        }
      }
    } else if (meta[code]) {
      try {
        await removeVersion(code);
        setMeta(getOfflineMeta());
      } catch {
        setError("清除离线缓存失败，请重试");
      }
    }
  };

  async function handleDownload(code: string) {
    if (busyVersion) return;
    setBusyVersion(code);
    setProgress({ done: 0, total: 66 });
    setError("");
    try {
      const run = code === JINGDU_KEY ? downloadCommentary : (cb: (d: number, t: number) => void) => downloadVersion(code, cb);
      await run((done, total) => setProgress({ done, total }));
      setMeta(getOfflineMeta());
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载失败，请检查网络后重试");
    } finally {
      setBusyVersion("");
      setProgress(null);
    }
  }

  async function handleRemove(code: string) {
    if (busyVersion) return;
    setBusyVersion(code);
    setError("");
    try {
      await (code === JINGDU_KEY ? removeCommentary() : removeVersion(code));
      setMeta(getOfflineMeta());
    } catch {
      setError("删除失败，请重试");
    } finally {
      setBusyVersion("");
    }
  }

  // 译本行：右侧一个开关管到底——打开 = 进阅读页译本列表并自动缓存离线包，
  // 关闭 = 从列表移除并清掉离线缓存。和合本是兜底默认译本，常开不可关。
  const versionRow = (code: string, label: string) => {
    const downloaded = meta[code];
    const downloading = busyVersion === code && progress;
    const enabled = enabledCodes.includes(code);
    return (
      <div className="me-res-row" key={code}>
        <span className="me-res-icon"><Icon name="book" size={18} /></span>
        <span className="me-res-copy">
          <b>{label}</b>
          <small>
            {code === "cuv"
              ? "默认译本 · 始终显示"
              : downloading
                ? `正在下载 ${progress.done}/${progress.total} 卷…`
                : enabled
                  ? downloaded
                    ? `已启用 · 离线 ${readableBytes(downloaded.bytes)}`
                    : "已启用"
                  : "未启用"}
          </small>
          {downloading && (
            <span className="me-res-bar">
              <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </span>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? `停用「${label}」并清除离线缓存` : `启用「${label}」并下载离线包`}
          className="me-res-toggle"
          disabled={code === "cuv" || Boolean(busyVersion)}
          onClick={() => void toggleVersion(code)}
        >
          <span className={`notification-switch${enabled ? " is-on" : ""}`} aria-hidden="true"><i /></span>
        </button>
      </div>
    );
  };

  // 注释行保留原「下载 / 删除」按钮（注释没有显示开关概念）
  const resourceRow = (code: string, label: string, icon: string) => {
    const downloaded = meta[code];
    const downloading = busyVersion === code && progress;
    return (
      <div className="me-res-row" key={code}>
        <span className="me-res-icon"><Icon name={icon} size={18} /></span>
        <span className="me-res-copy">
          <b>{label}</b>
          <small>
            {downloading
              ? `正在下载 ${progress.done}/${progress.total} 卷…`
              : downloaded
                ? `已下载 · ${readableBytes(downloaded.bytes)} · 66 卷`
                : "未下载 · 66 卷"}
          </small>
          {downloading && (
            <span className="me-res-bar">
              <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </span>
          )}
        </span>
        {downloaded ? (
          <button
            className={`me-res-btn${armedKey === `res:${code}` ? " is-danger" : ""}`}
            type="button"
            disabled={Boolean(busyVersion)}
            aria-label={armedKey === `res:${code}` ? `再点一次确认删除「${label}」` : `删除已下载的「${label}」`}
            onClick={() => confirm(`res:${code}`, () => void handleRemove(code))}
          >
            {armedKey === `res:${code}` ? "确认删除" : "删除"}
          </button>
        ) : (
          <button
            className="me-res-btn is-primary"
            type="button"
            disabled={!supported || Boolean(busyVersion)}
            onClick={() => void handleDownload(code)}
          >
            {downloading ? "下载中" : "下载"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="screen me-subpage">
      <UnifiedHeader
        title="资源管理"
        subtitle="译本与注释"
        ariaLabel="资源管理"
        onBack={goBack}
        backLabel="返回数据与账户"
      />
      <main className="screen-scroll me-detail-scroll">
        <section className="me-data-section">
          <div className="me-data-heading">
            <div>
              <h2>译本管理</h2>
              <p>打开开关即启用该译本并自动下载到本机，离线也能阅读；关闭则从译本列表移除并释放空间。</p>
            </div>
          </div>

          {!supported && (
            <p className="me-res-unsupported">当前环境不支持离线缓存，暂时无法下载译本。</p>
          )}

          {error && <p className="me-res-error" role="alert">{error}</p>}

          <div className="me-res-list">
            {VERSIONS.map((version) => versionRow(version.code, version.label))}
          </div>
        </section>

        <section className="me-data-section">
          <div className="me-data-heading">
            <div>
              <h2>注释</h2>
              <p>精读本注释全集，下载后离线也能查看逐段解经。</p>
            </div>
            <Icon name="align-justify" size={20} />
          </div>
          <div className="me-res-list">
            {resourceRow(JINGDU_KEY, "精读本注释", "align-justify")}
          </div>
        </section>

        {/* 语音圣经缓存：入口在播放器（按整卷缓存），这里做统一查看与删除 */}
        <section className="me-data-section">
          <div className="me-data-heading">
            <div>
              <h2>语音圣经</h2>
              <p>在语音圣经播放器里点右上角下载键，即可缓存整卷音频。</p>
            </div>
            <Icon name="volume-2" size={20} />
          </div>
          {Object.keys(audioMeta).length === 0 ? (
            <p className="me-res-unsupported">还没有缓存任何书卷的音频。</p>
          ) : (
            <div className="me-res-list">
              {Object.entries(audioMeta).map(([key, item]) => {
                const [voice, bookCode] = key.split(":");
                const label = bookName(getBookByCode(bookCode), getVersion("cuv"));
                const voiceLabel = voice === "female" ? "女声" : "男声";
                return (
                  <div className="me-res-row" key={key}>
                    <span className="me-res-icon"><Icon name="volume-2" size={18} /></span>
                    <span className="me-res-copy">
                      <b>{label} · {voiceLabel}</b>
                      <small>已缓存 · {readableBytes(item.bytes)} · {item.chapters}/{item.totalChapters} 章</small>
                    </span>
                    <button
                      className={`me-res-btn${armedKey === `audio:${bookCode}:${voice}` ? " is-danger" : ""}`}
                      type="button"
                      disabled={Boolean(busyVersion)}
                      aria-label={armedKey === `audio:${bookCode}:${voice}`
                        ? `再点一次确认删除《${label}》的音频缓存`
                        : `删除《${label}》（${voiceLabel}）的整卷音频缓存`}
                      onClick={() => confirm(`audio:${bookCode}:${voice}`, () => {
                        void removeBookAudio("cuv", bookCode, item.totalChapters, voice).then(() => {
                          setAudioMeta(getOfflineAudioMeta());
                        });
                      })}
                    >
                      {armedKey === `audio:${bookCode}:${voice}` ? "确认删除" : "删除"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="me-data-note">
          译本文件保存在本机缓存中，不占用云端空间；清除浏览器或应用数据会一并清除已下载的译本。
        </p>
      </main>
    </div>
  );
}
