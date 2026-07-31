import React, { createContext, useContext, useState, useEffect } from "react";
import { translateToTraditional } from "../utils/cc";

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

  useEffect(() => {
    localStorage.setItem("ob.bible.isTraditional", String(isTraditional));
  }, [isTraditional]);

  const translate = (text: string) =>
    isTraditional && text ? translateToTraditional(text) : text;

  return (
    <SettingsContext.Provider value={{ isTraditional, setIsTraditional, translate }}>
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
