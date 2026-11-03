import { useEffect, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import {
  JINGDU_KEY,
  commentaryHasUpdate,
  downloadCommentary,
  downloadVersion,
  getOfflineMeta,
  markCommentaryUpdated,
  offlineSupported,
  readableBytes,
  removeVersion,
} from "../data/offline-bible";
import { VERSIONS, getEnabledVersionCodes, setVersionEnabled } from "../data/scripture";

type Progress = { done: number; total: number };

export function ResourcesPage() {
  // 主入口是「我的」直达；兜底也回 /me（本页是设备级功能，不该被登录墙拦）
  const goBack = useAppBack("/me");
  const [meta, setMeta] = useState(getOfflineMeta);
  // 注释内容是否有新版（仅对已下载用户检查；离线/未下载不提示）
  const [commentaryUpdate, setCommentaryUpdate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    commentaryHasUpdate().then((result) => { if (!cancelled) setCommentaryUpdate(result); });
    return () => { cancelled = true; };
  }, []);
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

  // 注释有新版：重新拉取全集刷新本机缓存，记录新版本后提醒消除
  async function handleCommentaryUpdate() {
    if (busyVersion) return;
    setBusyVersion(JINGDU_KEY);
    setProgress({ done: 0, total: 66 });
    setError("");
    try {
      await downloadCommentary((done, total) => setProgress({ done, total }));
      await markCommentaryUpdated();
      setMeta(getOfflineMeta());
      setCommentaryUpdate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败，请检查网络后重试");
    } finally {
      setBusyVersion("");
      setProgress(null);
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

  // 注释随应用内置，没有下载/删除概念：平时不放按钮，
  // 只在内容有新版时亮红点并出现「更新」按钮
  const commentaryRow = () => {
    const downloading = busyVersion === JINGDU_KEY && progress;
    return (
      <div className="me-res-row" key={JINGDU_KEY}>
        <span className="me-res-icon"><Icon name="align-justify" size={18} /></span>
        <span className="me-res-copy">
          <b>
            精读本注释
            {commentaryUpdate && <i className="me-res-update-dot" aria-hidden="true" />}
          </b>
          <small>
            {downloading
              ? `正在更新 ${progress.done}/${progress.total} 卷…`
              : commentaryUpdate
                ? "内容有更新，点「更新」获取最新注释"
                : "全 66 卷 · 随应用提供"}
          </small>
          {downloading && (
            <span className="me-res-bar">
              <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </span>
          )}
        </span>
        {commentaryUpdate && (
          <button
            className="me-res-btn is-primary"
            type="button"
            disabled={Boolean(busyVersion)}
            onClick={() => void handleCommentaryUpdate()}
          >
            {downloading ? "更新中" : "更新"}
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
        backLabel="返回我的"
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
              <p>精读本注释全集随应用内置，内容有新版时在这里一键更新。</p>
            </div>
            <Icon name="align-justify" size={20} />
          </div>
          <div className="me-res-list">
            {commentaryRow()}
          </div>
        </section>

        <p className="me-data-note">
          译本文件保存在本机缓存中，不占用云端空间；清除浏览器或应用数据会一并清除已下载的译本。
        </p>
      </main>
    </div>
  );
}
