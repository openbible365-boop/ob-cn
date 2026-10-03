import { useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
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
import { VERSIONS, getBookByCode, getVersion, bookName } from "../data/scripture";

type Progress = { done: number; total: number };

export function ResourcesPage() {
  const goBack = useAppBack("/me/account");
  const [meta, setMeta] = useState(getOfflineMeta);
  const [audioMeta, setAudioMeta] = useState(getOfflineAudioMeta);
  // 同一时刻只允许一个译本在下载：拼音和合本有 50MB，上并发只会互相拖慢
  const [busyVersion, setBusyVersion] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const supported = offlineSupported();

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

  async function handleRemove(code: string, label: string) {
    if (busyVersion) return;
    if (!window.confirm(`删除已下载的「${label}」？删除后离线时将无法使用它。`)) return;
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

  // 译本与注释共用同一种行：状态文案、进度条、下载/删除按钮的逻辑完全一致
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
            className="me-res-btn"
            type="button"
            disabled={Boolean(busyVersion)}
            onClick={() => void handleRemove(code, label)}
          >
            删除
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
              <h2>译本下载</h2>
              <p>下载到本机后，没有网络也能阅读整本圣经。</p>
            </div>
            <Icon name="download" size={20} />
          </div>

          {!supported && (
            <p className="me-res-unsupported">当前环境不支持离线缓存，暂时无法下载译本。</p>
          )}

          {error && <p className="me-res-error" role="alert">{error}</p>}

          <div className="me-res-list">
            {VERSIONS.map((version) => resourceRow(version.code, version.label, "book"))}
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
                      className="me-res-btn"
                      type="button"
                      disabled={Boolean(busyVersion)}
                      onClick={() => {
                        if (!window.confirm(`删除《${label}》（${voiceLabel}）的整卷音频缓存？`)) return;
                        void removeBookAudio("cuv", bookCode, item.totalChapters, voice).then(() => {
                          setAudioMeta(getOfflineAudioMeta());
                        });
                      }}
                    >
                      删除
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
