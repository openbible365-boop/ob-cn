import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";

export type AnnotationAudioSegment = {
  id: string;
  reference: string;
  label: string;
  text: string;
};

type VoicePreference = "female" | "male";

function availableSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

function preferredVoice(voices: SpeechSynthesisVoice[], preference: VoicePreference) {
  const chineseVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("zh"));
  const candidates = chineseVoices.length > 0 ? chineseVoices : voices;
  const preferencePattern = preference === "female"
    ? /female|woman|xiaoxiao|tingting|mei|yaoyao|huihui/i
    : /male|man|yunxi|yunyang|kangkang|danny/i;
  return candidates.find((voice) => preferencePattern.test(voice.name)) ?? candidates[0] ?? null;
}

function speechChunks(text: string) {
  const sentences = text.match(/[^。！？；.!?;]+[。！？；.!?;]?/g) ?? [text];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 180) {
      chunks.push(trimmed);
      continue;
    }
    for (let start = 0; start < trimmed.length; start += 180) {
      chunks.push(trimmed.slice(start, start + 180));
    }
  }
  return chunks;
}

export function AnnotationAudioPlayer({
  open,
  displayBook,
  chapter,
  maxChapter,
  segments,
  isTraditional,
  translate = (text) => text,
  onClose,
  onChapterChange,
  onLocateSegment,
  onPlayingChange,
  onCurrentSegmentChange,
}: {
  open: boolean;
  displayBook: string;
  chapter: number;
  maxChapter: number;
  segments: AnnotationAudioSegment[];
  isTraditional: boolean;
  translate?: (text: string) => string;
  onClose: () => void;
  onChapterChange: (chapter: number) => void;
  onLocateSegment?: (segmentId: string) => void;
  onPlayingChange?: (playing: boolean) => void;
  onCurrentSegmentChange?: (segmentId: string | null) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voicePreference, setVoicePreference] = useState<VoicePreference>("female");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const speechRunRef = useRef(0);
  const continueAfterChapterRef = useRef(false);
  const previousChapterRef = useRef(chapter);

  const currentSegment = segments[currentIndex] ?? segments[0] ?? null;
  const progress = segments.length > 1 ? currentIndex / (segments.length - 1) * 100 : 0;

  useEffect(() => {
    const speech = availableSpeech();
    if (!speech) return;
    const updateVoices = () => setVoices(speech.getVoices());
    updateVoices();
    speech.addEventListener?.("voiceschanged", updateVoices);
    return () => speech.removeEventListener?.("voiceschanged", updateVoices);
  }, []);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onCurrentSegmentChange?.(currentSegment?.id ?? null);
  }, [currentSegment?.id, onCurrentSegmentChange]);

  const stopSpeech = useCallback(() => {
    speechRunRef.current += 1;
    availableSpeech()?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const speakSegment = useCallback((index: number, rate = speed, voice = voicePreference) => {
    const speech = availableSpeech();
    const segment = segments[index];
    if (!speech) {
      setError(translate("当前设备不支持语音朗读"));
      return;
    }
    if (!segment) {
      setError(translate("本章暂无可朗读的注释"));
      return;
    }

    speechRunRef.current += 1;
    const runId = speechRunRef.current;
    speech.cancel();
    setCurrentIndex(index);
    setError("");
    setIsPaused(false);

    const chunks = speechChunks(
      `${segment.reference}，${segment.label}。${segment.text}`,
    );
    const speakChunk = (chunkIndex: number) => {
      const chunk = chunks[chunkIndex];
      if (!chunk || speechRunRef.current !== runId) return;
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = isTraditional ? "zh-TW" : "zh-CN";
      utterance.rate = rate;
      utterance.pitch = voice === "female" ? 1.04 : 0.94;
      utterance.voice = preferredVoice(voices, voice);
      utterance.onstart = () => {
        if (speechRunRef.current === runId) setIsPlaying(true);
      };
      utterance.onerror = () => {
        if (speechRunRef.current !== runId) return;
        setIsPlaying(false);
        setIsPaused(false);
        setError(translate("注释朗读暂时不可用，请稍后重试"));
      };
      utterance.onend = () => {
        if (speechRunRef.current !== runId) return;
        if (chunkIndex < chunks.length - 1) {
          speakChunk(chunkIndex + 1);
          return;
        }
        if (index < segments.length - 1) {
          speakSegment(index + 1, rate, voice);
          return;
        }
        setIsPlaying(false);
        setIsPaused(false);
        if (chapter < maxChapter) {
          continueAfterChapterRef.current = true;
          onChapterChange(chapter + 1);
        }
      };
      speech.speak(utterance);
    };
    speakChunk(0);
  }, [
    chapter,
    isTraditional,
    maxChapter,
    onChapterChange,
    segments,
    speed,
    translate,
    voicePreference,
    voices,
  ]);

  useEffect(() => {
    if (previousChapterRef.current === chapter) return;
    previousChapterRef.current = chapter;
    stopSpeech();
    setCurrentIndex(0);
  }, [chapter, stopSpeech]);

  useEffect(() => {
    if (!continueAfterChapterRef.current || segments.length === 0) return;
    continueAfterChapterRef.current = false;
    speakSegment(0);
  }, [segments, speakSegment]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  const toggleSpeech = () => {
    const speech = availableSpeech();
    if (!speech) {
      setError(translate("当前设备不支持语音朗读"));
      return;
    }
    if (isPaused) {
      speech.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      speech.pause();
      setIsPaused(true);
      setIsPlaying(false);
      return;
    }
    speakSegment(currentIndex);
  };

  const gotoSegment = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), Math.max(segments.length - 1, 0));
    if (isPlaying || isPaused) speakSegment(nextIndex);
    else setCurrentIndex(nextIndex);
  };

  const changeSpeed = () => {
    const nextSpeed = speed >= 1.5 ? 0.75 : speed + 0.25;
    setSpeed(nextSpeed);
    if (isPlaying || isPaused) speakSegment(currentIndex, nextSpeed);
  };

  const changeVoice = (voice: VoicePreference) => {
    setVoicePreference(voice);
    setVoiceMenuOpen(false);
    if (isPlaying || isPaused) speakSegment(currentIndex, speed, voice);
  };

  const changeChapter = (nextChapter: number) => {
    continueAfterChapterRef.current = false;
    stopSpeech();
    onChapterChange(nextChapter);
  };

  if (!open) return null;

  return (
    <>
      <div className="audio-player-scrim" onClick={onClose} />
      <section
        className="audio-player-sheet annotation-audio-player"
        role="dialog"
        aria-modal="true"
        aria-label={`${displayBook}${translate("第")}${chapter}${translate("章注释朗读")}`}
      >
        <div className="audio-player-kicker">
          <Icon name="volume-2" size={18} />
          <span>{translate("注释朗读")}</span>
          <button
            type="button"
            className="audio-player-close"
            aria-label={translate("关闭注释朗读窗口")}
            onClick={onClose}
          >
            <Icon name="x" size={22} />
          </button>
        </div>

        <h2 className="audio-player-title">{displayBook} {chapter}</h2>
        <div
          className={`audio-player-status${error ? " error" : segments.length === 0 ? " loading" : " ready"}`}
          role="status"
          aria-live="polite"
        >
          <span className="audio-status-indicator" aria-hidden="true" />
          <span>{error || (segments.length === 0
            ? translate("正在准备本章注释")
            : `${translate("共")} ${segments.length} ${translate("段注释")}`)}</span>
        </div>

        <div className="audio-progress-wrap">
          <input
            className="audio-progress"
            type="range"
            min="0"
            max={Math.max(segments.length - 1, 0)}
            step="1"
            value={Math.min(currentIndex, Math.max(segments.length - 1, 0))}
            disabled={segments.length === 0}
            aria-label={translate("注释朗读进度")}
            style={{ "--audio-progress": `${progress}%` } as CSSProperties}
            onChange={(event) => gotoSegment(Number(event.target.value))}
          />
          <div className="audio-time-row">
            <span>{translate("第")} {segments.length > 0 ? currentIndex + 1 : 0} {translate("段")}</span>
            <span>{translate("共")} {segments.length} {translate("段")}</span>
            <button type="button" onClick={changeSpeed}>
              {speed.toFixed(2).replace(/0$/, "")}×
            </button>
          </div>
        </div>

        <div className="audio-controls">
          <button
            type="button"
            aria-label={translate("上一章注释")}
            disabled={chapter <= 1}
            onClick={() => changeChapter(chapter - 1)}
          >
            <Icon name="skip-back" size={27} />
          </button>
          <button
            type="button"
            aria-label={translate("上一段注释")}
            disabled={currentIndex <= 0 || segments.length === 0}
            onClick={() => gotoSegment(currentIndex - 1)}
          >
            <Icon name="chevron-left" size={25} />
          </button>
          <button
            type="button"
            className="audio-play-button"
            disabled={segments.length === 0}
            aria-label={translate(isPlaying ? "暂停注释朗读" : "播放注释")}
            onClick={toggleSpeech}
          >
            <Icon name={isPlaying ? "pause" : "play"} size={28} />
          </button>
          <button
            type="button"
            aria-label={translate("下一段注释")}
            disabled={currentIndex >= segments.length - 1 || segments.length === 0}
            onClick={() => gotoSegment(currentIndex + 1)}
          >
            <Icon name="chevron-right" size={25} />
          </button>
          <button
            type="button"
            aria-label={translate("下一章注释")}
            disabled={chapter >= maxChapter}
            onClick={() => changeChapter(chapter + 1)}
          >
            <Icon name="skip-forward" size={27} />
          </button>
        </div>

        <button
          type="button"
          className="audio-current-passage"
          disabled={!currentSegment}
          onClick={() => {
            if (!currentSegment) return;
            onClose();
            onLocateSegment?.(currentSegment.id);
          }}
        >
          <span className="audio-current-icon">
            <span className="audio-wave" aria-hidden="true"><i /><i /><i /><i /></span>
          </span>
          <span className="audio-current-copy">
            <b>{translate(isPlaying ? "正在朗读" : isPaused ? "已暂停" : "当前段落")} · {currentSegment?.reference ?? "—"} {currentSegment?.label ?? ""}</b>
            <small>{currentSegment?.text ?? translate("注释加载中…")}</small>
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
                {voicePreference === "female" ? "女" : "男"}
              </span>
              <span className="audio-voice-selected">
                {translate("音色")} · {translate(voicePreference === "female" ? "清晰女声 · 温柔自然" : "沉稳男声 · 清楚从容")}
              </span>
              <span className="audio-voice-chevron" aria-hidden="true">
                <Icon name="chevron-down" size={18} />
              </span>
            </button>
            {voiceMenuOpen && (
              <div className="audio-voice-menu" role="listbox" aria-label={translate("注释朗读音色")}>
                {[
                  { id: "female" as const, mark: "女", name: "清晰女声", detail: "温柔自然" },
                  { id: "male" as const, mark: "男", name: "沉稳男声", detail: "清楚从容" },
                ].map((voice) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={voicePreference === voice.id}
                    className={voicePreference === voice.id ? "active" : ""}
                    key={voice.id}
                    onClick={() => changeVoice(voice.id)}
                  >
                    <span className="audio-voice-avatar">{voice.mark}</span>
                    <span><b>{translate(voice.name)}</b><small>{translate(voice.detail)}</small></span>
                    <span className="audio-voice-menu-check">
                      {voicePreference === voice.id && <Icon name="check" size={16} />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
