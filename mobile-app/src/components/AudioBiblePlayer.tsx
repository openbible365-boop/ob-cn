import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
import {
  BOOKS,
  getBookByCode,
  loadBook,
  stripHtml,
  type Verse,
} from "../data/scripture";
import { fetchChapterAudio, type AudioTimestamp } from "../data/audio";
import {
  hasAndroidMediaControls,
  listenForAndroidMediaControls,
  requestAndroidMediaPermission,
  stopAndroidMedia,
  updateAndroidMedia,
} from "../data/android-media";

export const PlayingAudioIcon = () => (
  <span className="playing-audio-icon" aria-hidden="true">
    <i /><i /><i />
  </span>
);

export function AudioBiblePlayer({
  open,
  versionCode,
  versionLabel,
  bookCode,
  displayBook,
  chapter,
  maxChapter,
  onClose,
  onChapterChange,
  onLocateVerse,
  onPlayingChange,
  onCurrentVerseChange,
}: {
  open: boolean;
  versionCode: string;
  versionLabel: string;
  bookCode: string;
  displayBook: string;
  chapter: number;
  maxChapter: number;
  onClose: () => void;
  onChapterChange: (bookCode: string, chapter: number) => void;
  onLocateVerse?: (verse: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onCurrentVerseChange?: (verse: number | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const androidMediaStartedRef = useRef(false);
  const continueAudioAfterLoadRef = useRef(false);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [audioVoice, setAudioVoice] = useState("female");
  const [resolvedAudioVoice, setResolvedAudioVoice] = useState("");
  const [audioRequestVersion, setAudioRequestVersion] = useState(0);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioTimestamps, setAudioTimestamps] = useState<AudioTimestamp[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [loadedAudioKey, setLoadedAudioKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBook(versionCode, bookCode)
      .then((data) => {
        if (!cancelled) setVerses(data.chapters.get(chapter) ?? []);
      })
      .catch(() => {
        if (!cancelled) setVerses([]);
      });
    return () => { cancelled = true; };
  }, [versionCode, bookCode, chapter]);

  useEffect(() => {
    onPlayingChange?.(audioPlaying);
  }, [audioPlaying, onPlayingChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = audioSpeed;
  }, [audioSpeed]);

  useEffect(() => {
    if (!open && !continueAudioAfterLoadRef.current) return;
    const currentKey = `${versionCode}-${bookCode}-${chapter}-${audioVoice}-${audioRequestVersion}`;
    if (loadedAudioKey === currentKey) return;

    const audio = audioRef.current;
    audio?.pause();
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioUrl("");
    setAudioTimestamps([]);
    setResolvedAudioVoice("");
    setAudioError("");

    if (versionCode !== "cuv") {
      continueAudioAfterLoadRef.current = false;
      setLoadedAudioKey(null);
      setAudioError("当前仅和合本提供语音圣经，请先切换到和合本");
      return;
    }

    let cancelled = false;
    setAudioLoading(true);
    fetchChapterAudio(versionCode, bookCode, chapter, audioVoice)
      .then((result) => {
        if (cancelled) return;
        setAudioUrl(result.audioUrl);
        setAudioTimestamps(result.timestamps);
        setResolvedAudioVoice(result.voice);
        setLoadedAudioKey(currentKey);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        continueAudioAfterLoadRef.current = false;
        setAudioError(error instanceof Error ? error.message : "当前章节暂无音频");
        setLoadedAudioKey(null);
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    open,
    versionCode,
    bookCode,
    chapter,
    audioVoice,
    audioRequestVersion,
    loadedAudioKey,
  ]);

  const displayedAudioVoice = resolvedAudioVoice || audioVoice;
  const audioProgress = audioDuration > 0
    ? Math.min(100, audioCurrentTime / audioDuration * 100)
    : 0;
  const timestampDuration = audioTimestamps.at(-1)?.end ?? 0;
  const timestampTime = audioDuration > 0 && timestampDuration > 0
    ? audioCurrentTime * timestampDuration / audioDuration
    : audioCurrentTime;
  const timestampVerse = audioTimestamps.find(
    (item) => timestampTime >= item.start && timestampTime < item.end,
  ) ?? (timestampTime > 0 ? audioTimestamps.at(-1) : null);
  const fallbackAudioIndex = Math.min(
    Math.max(verses.length - 1, 0),
    Math.floor(audioProgress / 100 * Math.max(verses.length, 1)),
  );
  const audioCurrentVerse = verses.find((verse) => verse.verse === timestampVerse?.verse)
    ?? verses[fallbackAudioIndex]
    ?? verses[0]
    ?? null;
  const audioCurrentVerseNumber = audioCurrentVerse?.verse ?? null;
  const audioCurrentVerseText = audioCurrentVerse ? stripHtml(audioCurrentVerse.text) : "";
  const audioCurrentTimeSecond = Math.floor(audioCurrentTime);

  useEffect(() => {
    onCurrentVerseChange?.(audioCurrentVerseNumber);
  }, [audioCurrentVerseNumber, onCurrentVerseChange]);

  useEffect(() => {
    if (
      !audioUrl
      || !audioCurrentVerse
      || !("mediaSession" in navigator)
      || typeof MediaMetadata === "undefined"
    ) {
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${displayBook} ${chapter}:${audioCurrentVerse.label} · ${versionLabel}`,
      artist: audioCurrentVerseText,
      album: "OpenBible · 语音圣经",
      artwork: hasAndroidMediaControls() ? [] : [
        {
          src: new URL("/openbible-now-playing.png", window.location.href).href,
          sizes: "1024x1024",
          type: "image/png",
        },
      ],
    });
  }, [
    audioUrl,
    displayBook,
    chapter,
    versionLabel,
    audioCurrentVerse,
    audioCurrentVerseText,
  ]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = audioPlaying ? "playing" : "paused";
  }, [audioPlaying]);

  const seekAudio = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  };

  useEffect(() => {
    if (!hasAndroidMediaControls()) return;
    let handle: Awaited<ReturnType<typeof listenForAndroidMediaControls>> | null = null;
    let cancelled = false;
    listenForAndroidMediaControls((event) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (event.action === "play") void audio.play();
      else if (event.action === "pause") audio.pause();
      else if (event.action === "stop") {
        audio.pause();
        void stopAndroidMedia();
        androidMediaStartedRef.current = false;
      } else if (event.action === "seekBackward") seekAudio(-30);
      else if (event.action === "seekForward") seekAudio(30);
      else if (event.action === "seekTo" && typeof event.positionMs === "number") {
        audio.currentTime = Math.min(audio.duration || 0, Math.max(0, event.positionMs / 1000));
      }
    }).then((listenerHandle) => {
      if (cancelled) void listenerHandle.remove();
      else handle = listenerHandle;
    });
    return () => {
      cancelled = true;
      void handle?.remove();
      if (androidMediaStartedRef.current) {
        void stopAndroidMedia();
        androidMediaStartedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!hasAndroidMediaControls() || !audioUrl || !audioCurrentVerse) return;
    let cancelled = false;
    const updateNativeMedia = async () => {
      if (audioPlaying && !androidMediaStartedRef.current) {
        await requestAndroidMediaPermission();
        if (cancelled) return;
        androidMediaStartedRef.current = true;
      }
      if (!androidMediaStartedRef.current) return;
      try {
        await updateAndroidMedia({
          title: `${displayBook} ${chapter}:${audioCurrentVerse.label} · ${versionLabel}`,
          text: audioCurrentVerseText,
          album: "OpenBible · 语音圣经",
          playing: audioPlaying,
          durationMs: Math.round(audioDuration * 1000),
          positionMs: audioCurrentTimeSecond * 1000,
          speed: audioSpeed,
        });
      } catch {
        // Native media controls must not interrupt in-app playback.
      }
    };
    void updateNativeMedia();
    return () => { cancelled = true; };
  }, [
    audioUrl,
    audioPlaying,
    audioDuration,
    audioCurrentTimeSecond,
    audioSpeed,
    displayBook,
    chapter,
    versionLabel,
    audioCurrentVerse,
    audioCurrentVerseText,
  ]);

  useEffect(() => {
    if (
      !("mediaSession" in navigator)
      || typeof navigator.mediaSession.setPositionState !== "function"
      || audioDuration <= 0
    ) {
      return;
    }
    try {
      navigator.mediaSession.setPositionState({
        duration: audioDuration,
        playbackRate: audioSpeed,
        position: Math.min(audioDuration, Math.max(0, audioCurrentTime)),
      });
    } catch {
      // Some WebKit versions expose Media Session without position updates.
    }
  }, [audioCurrentTime, audioDuration, audioSpeed]);

  const chooseAudioVoice = (voice: string) => {
    setVoiceMenuOpen(false);
    setResolvedAudioVoice("");
    if (voice === audioVoice) setAudioRequestVersion((value) => value + 1);
    else setAudioVoice(voice);
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      setAudioError("音频播放失败，请检查网络后重试");
    }
  };

  const gotoAudioChapter = (nextChapter: number) => {
    continueAudioAfterLoadRef.current = false;
    audioRef.current?.pause();
    onChapterChange(bookCode, nextChapter);
  };

  const continueToNextAudioChapter = () => {
    const currentBookIndex = BOOKS.findIndex((candidate) => candidate.code === bookCode);
    const nextBook = chapter < maxChapter ? getBookByCode(bookCode) : BOOKS[currentBookIndex + 1];
    if (!nextBook) {
      continueAudioAfterLoadRef.current = false;
      return;
    }
    continueAudioAfterLoadRef.current = true;
    onChapterChange(nextBook.code, chapter < maxChapter ? chapter + 1 : 1);
  };

  const formatAudioTime = (seconds: number) => {
    const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setAudioDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          event.currentTarget.playbackRate = audioSpeed;
        }}
        onCanPlay={(event) => {
          if (!continueAudioAfterLoadRef.current) return;
          continueAudioAfterLoadRef.current = false;
          void event.currentTarget.play().catch(() => {
            setAudioError("下一章自动播放失败，请点击播放继续");
          });
        }}
        onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setAudioPlaying(true)}
        onPause={() => setAudioPlaying(false)}
        onEnded={() => {
          setAudioPlaying(false);
          continueToNextAudioChapter();
        }}
        onError={() => {
          continueAudioAfterLoadRef.current = false;
          if (audioUrl) setAudioError("音频文件加载失败，请稍后重试");
        }}
      />

      {open && (
        <>
          <div className="audio-player-scrim" onClick={onClose} />
          <section
            className="audio-player-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${displayBook}第${chapter}章语音圣经`}
          >
            <div className="audio-player-handle" />
            <div className="audio-player-kicker">
              <Icon name="volume-2" size={18} />
              <span>语音圣经</span>
              <button
                type="button"
                className="audio-player-close"
                aria-label="关闭语音圣经"
                onClick={onClose}
              >
                <Icon name="x" size={22} />
              </button>
            </div>
            <h2 className="audio-player-title">{displayBook} {chapter}</h2>
            <div
              className={`audio-player-status${audioError ? " error" : audioLoading || !audioUrl ? " loading" : " ready"}`}
              role="status"
              aria-live="polite"
            >
              <span className="audio-status-indicator" aria-hidden="true" />
              <span>{audioError || (audioLoading || !audioUrl ? "正在准备本章音频" : "本章音频已就绪")}</span>
            </div>

            <div className="audio-progress-wrap">
              <input
                className="audio-progress"
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={audioProgress}
                disabled={!audioUrl || audioDuration <= 0}
                aria-label="播放进度"
                style={{ "--audio-progress": `${audioProgress}%` } as CSSProperties}
                onChange={(event) => {
                  const audio = audioRef.current;
                  if (audio?.duration) {
                    audio.currentTime = audio.duration * Number(event.target.value) / 100;
                  }
                }}
              />
              <div className="audio-time-row">
                <span>{formatAudioTime(audioCurrentTime)}</span>
                <span>{formatAudioTime(audioDuration)}</span>
                <button
                  type="button"
                  onClick={() => setAudioSpeed((speed) => speed === 2 ? 0.75 : speed + 0.25)}
                >
                  {audioSpeed.toFixed(2).replace(/0$/, "")}×
                </button>
              </div>
            </div>

            <div className="audio-controls">
              <button
                type="button"
                aria-label="上一章"
                disabled={chapter <= 1 || audioLoading}
                onClick={() => gotoAudioChapter(chapter - 1)}
              >
                <Icon name="skip-back" size={27} />
              </button>
              <button type="button" aria-label="后退30秒" disabled={!audioUrl} onClick={() => seekAudio(-30)}>
                <span className="audio-seek-icon"><Icon name="rotate-ccw" size={24} /><b>30</b></span>
              </button>
              <button
                type="button"
                className="audio-play-button"
                disabled={!audioUrl || audioLoading}
                aria-label={audioPlaying ? "暂停" : "播放"}
                onClick={toggleAudio}
              >
                <Icon name={audioPlaying ? "pause" : "play"} size={28} />
              </button>
              <button type="button" aria-label="前进30秒" disabled={!audioUrl} onClick={() => seekAudio(30)}>
                <span className="audio-seek-icon"><Icon name="rotate-cw" size={24} /><b>30</b></span>
              </button>
              <button
                type="button"
                aria-label="下一章"
                disabled={chapter >= maxChapter || audioLoading}
                onClick={() => gotoAudioChapter(chapter + 1)}
              >
                <Icon name="skip-forward" size={27} />
              </button>
            </div>

            <button
              type="button"
              className="audio-current-passage"
              onClick={() => {
                onClose();
                if (audioCurrentVerseNumber !== null) onLocateVerse?.(audioCurrentVerseNumber);
              }}
            >
              <span className="audio-current-icon">
                <span className="audio-wave" aria-hidden="true"><i /><i /><i /><i /></span>
              </span>
              <span className="audio-current-copy">
                <b>正在朗读 · {displayBook} {chapter}:{audioCurrentVerse?.label ?? 1}</b>
                <small>{audioCurrentVerse ? audioCurrentVerseText : "经文加载中…"}</small>
              </span>
              <Icon name="chevron-right" size={20} />
            </button>

            <div className="audio-voice-section">
              <div className="audio-voice-picker">
                <button
                  type="button"
                  className={`audio-voice-select-wrap${voiceMenuOpen ? " open" : ""}`}
                  aria-haspopup="listbox"
                  aria-expanded={voiceMenuOpen}
                  onClick={() => setVoiceMenuOpen((value) => !value)}
                >
                  <span className="audio-voice-avatar" aria-hidden="true">
                    {displayedAudioVoice === "female" ? "女" : "男"}
                  </span>
                  <span className="audio-voice-selected">
                    音色 · {displayedAudioVoice === "female" ? "知性女声 · 温柔自然" : "开朗学长 · 清晰沉稳"}
                  </span>
                  <span className="audio-voice-chevron" aria-hidden="true">
                    <Icon name="chevron-down" size={18} />
                  </span>
                </button>
                {voiceMenuOpen && (
                  <div className="audio-voice-menu" role="listbox" aria-label="朗读音色">
                    {[
                      { id: "female", mark: "女", name: "知性女声", detail: "温柔自然" },
                      { id: "male", mark: "男", name: "开朗学长", detail: "清晰沉稳" },
                    ].map((voice) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={displayedAudioVoice === voice.id}
                        className={displayedAudioVoice === voice.id ? "active" : ""}
                        key={voice.id}
                        onClick={() => chooseAudioVoice(voice.id)}
                      >
                        <span className="audio-voice-avatar">{voice.mark}</span>
                        <span><b>{voice.name}</b><small>{voice.detail}</small></span>
                        <span className="audio-voice-menu-check">
                          {displayedAudioVoice === voice.id && <Icon name="check" size={16} />}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
