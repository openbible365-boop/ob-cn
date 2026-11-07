import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

// 语音输入双通道：
// - 原生 App 走 @capacitor-community/speech-recognition（安卓/iOS 系统识别引擎，
//   WebView 不提供 Web Speech API，这是 App 内唯一可行的路）；
// - 浏览器走 Web Speech API（Chrome/Edge 可用，识别由浏览器云服务完成）。
// 两条通道行为一致：单句模式、语言跟随手机系统、实时上屏、追加在已有文字之后。

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const IS_NATIVE = Capacitor.isNativePlatform();

/**
 * 识别语言跟随手机系统语言：韩语系统识别韩语、英语系统识别英语；
 * 繁体中文系统（台湾 / 香港）或 App 里开了繁体，识别繁体中文；其余识别简体中文。
 */
export function speechRecognitionLanguage(): string {
  if (typeof navigator === "undefined") return "zh-CN";
  const device = (navigator.languages?.[0] || navigator.language || "").toLowerCase();
  if (device.startsWith("ko")) return "ko-KR";
  if (device.startsWith("en")) return "en-US";
  let traditional = false;
  try {
    traditional = localStorage.getItem("ob.bible.isTraditional") === "true";
  } catch {
    // 读不了本机设置就按系统语言判断
  }
  if (traditional || /^zh-(tw|hk|mo|hant)/.test(device)) return "zh-TW";
  return "zh-CN";
}
const MAX_LENGTH = 1200;

function recognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function speechErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "无法使用麦克风，请在浏览器设置中允许麦克风权限。";
  }
  if (error === "audio-capture") return "没有找到可用的麦克风。";
  if (error === "no-speech") return "没有听到声音，请靠近麦克风再试。";
  if (error === "network") return "语音识别网络暂时不可用，请稍后重试。";
  if (error === "aborted") return "";
  return "语音识别失败，请重试或改用键盘输入。";
}

async function nativePlugin() {
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
  return SpeechRecognition;
}

export function useSpeechInput(input: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled = false } = input;
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  // 原生平台先乐观认为支持，mount 后用 available() 校验一次
  const [nativeAvailable, setNativeAvailable] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const nativeActiveRef = useRef(false);
  const isSupported = IS_NATIVE ? nativeAvailable : Boolean(recognitionConstructor());

  useEffect(() => {
    if (!IS_NATIVE) return;
    let active = true;
    void nativePlugin()
      .then((plugin) => plugin.available())
      .then(({ available }) => { if (active) setNativeAvailable(available); })
      .catch(() => { if (active) setNativeAvailable(false); });
    return () => { active = false; };
  }, []);

  const stopNative = useCallback(() => {
    nativeActiveRef.current = false;
    setIsListening(false);
    void nativePlugin().then(async (plugin) => {
      await plugin.stop().catch(() => {});
      await plugin.removeAllListeners().catch(() => {});
    }).catch(() => {});
  }, []);

  const startNative = useCallback(async () => {
    const plugin = await nativePlugin();
    const permission = await plugin.requestPermissions();
    if (permission.speechRecognition !== "granted") {
      setError("无法使用麦克风，请在系统设置中允许本应用的麦克风与语音识别权限。");
      return;
    }

    const initialValue = value.trimEnd();
    const prefix = initialValue ? `${initialValue} ` : "";

    await plugin.removeAllListeners().catch(() => {});
    await plugin.addListener("partialResults", ({ matches }) => {
      const transcript = matches?.[0] ?? "";
      if (transcript) onChange(`${prefix}${transcript}`.slice(0, MAX_LENGTH));
    });
    await plugin.addListener("listeningState", ({ status }) => {
      if (status === "stopped") {
        nativeActiveRef.current = false;
        setIsListening(false);
        void plugin.removeAllListeners().catch(() => {});
      }
    });

    setError("");
    nativeActiveRef.current = true;
    setIsListening(true);
    try {
      // 单句模式：说完一句系统自动停止，与网页端行为一致
      await plugin.start({ language: speechRecognitionLanguage(), partialResults: true, popup: false, maxResults: 2 });
    } catch {
      nativeActiveRef.current = false;
      setIsListening(false);
      await plugin.removeAllListeners().catch(() => {});
      setError("语音输入启动失败，请重试。");
    }
  }, [onChange, value]);

  const stopListening = useCallback(() => {
    if (IS_NATIVE) {
      stopNative();
      return;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, [stopNative]);

  const startListening = useCallback(() => {
    if (disabled || isListening) return;

    if (IS_NATIVE) {
      void startNative().catch(() => {
        nativeActiveRef.current = false;
        setIsListening(false);
        setError("语音输入启动失败，请重试。");
      });
      return;
    }

    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setError("当前环境不支持语音输入，请使用键盘输入。");
      return;
    }

    const recognition = new Recognition();
    const initialValue = value.trimEnd();
    const prefix = initialValue ? `${initialValue} ` : "";
    let finalTranscript = "";
    recognition.lang = speechRecognitionLanguage();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript ?? "";
        if (event.results[index]?.isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      onChange(`${prefix}${finalTranscript}${interimTranscript}`.slice(0, MAX_LENGTH));
    };
    recognition.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      if (message) setError(message);
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    setError("");
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError("语音输入启动失败，请重试。");
    }
  }, [disabled, isListening, onChange, startNative, value]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    if (!disabled) return;
    if (IS_NATIVE) {
      if (nativeActiveRef.current) stopNative();
      return;
    }
    if (!recognitionRef.current) return;
    recognitionRef.current.abort();
    recognitionRef.current = null;
    setIsListening(false);
  }, [disabled, stopNative]);

  useEffect(
    () => () => {
      if (IS_NATIVE) {
        if (nativeActiveRef.current) {
          void nativePlugin().then(async (plugin) => {
            await plugin.stop().catch(() => {});
            await plugin.removeAllListeners().catch(() => {});
          }).catch(() => {});
        }
        return;
      }
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  return {
    isSupported,
    isListening,
    error,
    clearError: () => setError(""),
    startListening,
    stopListening,
    toggleListening,
  };
}
