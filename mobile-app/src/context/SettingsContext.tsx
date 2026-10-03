import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadTraditionalConverter, translateToTraditional } from "../utils/cc";

interface SettingsContextType {
  isTraditional: boolean;
  setIsTraditional: (value: boolean) => void;
  translate: (text: string) => string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isTraditional, setIsTraditional] = useState(
    () => localStorage.getItem("ob.bible.isTraditional") === "true",
  );
  // 繁体词典是异步装载的（见 utils/cc.ts）；装好后 bump 一次让已渲染的文本换繁体
  const [converterReady, setConverterReady] = useState(false);

  useEffect(() => {
    localStorage.setItem("ob.bible.isTraditional", String(isTraditional));
    if (isTraditional) {
      void loadTraditionalConverter().then(() => setConverterReady(true));
    }
  }, [isTraditional]);

  const translate = useCallback(
    (text: string) => (isTraditional && text ? translateToTraditional(text) : text),
    // converterReady 变化时换一个函数标识，促使使用方重译
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTraditional, converterReady],
  );

  const value = useMemo(
    () => ({ isTraditional, setIsTraditional, translate }),
    [isTraditional, translate],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
