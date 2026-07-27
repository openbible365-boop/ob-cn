import { useCallback, useEffect, useRef, useState } from "react";

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

export function useSpeechInput(input: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled = false } = input;
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isSupported = Boolean(recognitionConstructor());

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (disabled || isListening) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setError("当前浏览器不支持语音输入，请使用键盘输入。");
      return;
    }

    const recognition = new Recognition();
    const initialValue = value.trimEnd();
    const prefix = initialValue ? `${initialValue} ` : "";
    let finalTranscript = "";
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript ?? "";
        if (event.results[index]?.isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      onChange(`${prefix}${finalTranscript}${interimTranscript}`.slice(0, 1200));
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
  }, [disabled, isListening, onChange, value]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    if (!disabled || !recognitionRef.current) return;
    recognitionRef.current.abort();
    recognitionRef.current = null;
    setIsListening(false);
  }, [disabled]);

  useEffect(
    () => () => {
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
