import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadTraditionalConverter, translateToTraditional } from "../utils/cc";

interface SettingsContextType {
  isEnglish: boolean;
  isTraditional: boolean;
  setIsTraditional: (value: boolean) => void;
  translate: (text: string) => string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

// English labels are added only after their wording has been approved. Text
// that is not listed here remains Chinese until its English wording is agreed.
const ENGLISH_LABELS: Record<string, string> = {
  "我的": "Mine",
  "登录或注册": "Sign In / Sign Up",
  "登录 / 注册": "Sign In / Sign Up",
  "慧读圣经": "OpenBible",
  "智慧 · 读经 · 共勉": "Wisdom · Scripture · Fellowship",
  "用户协议": "User Agreement",
  "隐私政策": "Privacy Policy",
  "意见反馈": "Feedback",
  "圣经": "Bible",
  "注释": "Commentary",
  "慧读": "Open Reading",
  "社群": "Community",
  "验证码登录": "Verification Code",
  "密码登录": "Password",
  "邮箱地址": "Email Address",
  "6 位验证码": "6-Digit Code",
  "获取验证码": "Send Code",
  "首次使用同一邮箱登录将自动注册": "New users will be registered automatically.",
  "或": "Or",
  "通过 Apple 登录": "Sign in with Apple",
  "使用 Google 登录": "Sign in with Google",
  "Google 登录 · 请在 App 使用": "Sign in with Google",
  "用户名或邮箱": "Username or Email",
  "密码": "Password",
  "登录": "Sign In",
  "密码登录仅限已开通密码的账号": "Password sign-in is only available for accounts with a password.",
  "显示密码": "Show Password",
  "隐藏密码": "Hide Password",
  "请稍候…": "Please wait…",
  "正在连接 Apple…": "Connecting to Apple…",
  "正在连接 Google…": "Connecting to Google…",
  "请输入有效的邮箱地址": "Please enter a valid email address.",
  "请输入 6 位数字验证码": "Please enter the 6-digit verification code.",
  "请输入账号和密码": "Please enter your username or email and password.",
  "Google 登录失败，请稍后重试": "Google sign-in failed. Please try again later.",
  "Apple 登录失败，请稍后重试": "Apple sign-in failed. Please try again later.",
  "账号登录": "Account Sign-In",
  "返回我的": "Back to Mine",
  "登录方式": "Sign-In Method",
};

function deviceUsesEnglish() {
  if (typeof navigator === "undefined") return false;
  const language = navigator.languages?.[0] || navigator.language || "";
  return language.toLowerCase().startsWith("en");
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isEnglish, setIsEnglish] = useState(deviceUsesEnglish);
  const [isTraditional, setIsTraditional] = useState(
    () => localStorage.getItem("ob.bible.isTraditional") === "true",
  );
  // 繁体词典是异步装载的（见 utils/cc.ts）；装好后 bump 一次让已渲染的文本换繁体
  const [converterReady, setConverterReady] = useState(false);

  useEffect(() => {
    const refreshLanguage = () => setIsEnglish(deviceUsesEnglish());
    window.addEventListener("languagechange", refreshLanguage);
    return () => window.removeEventListener("languagechange", refreshLanguage);
  }, []);

  useEffect(() => {
    localStorage.setItem("ob.bible.isTraditional", String(isTraditional));
    if (isTraditional) {
      void loadTraditionalConverter().then(() => setConverterReady(true));
    }
  }, [isTraditional]);

  const translate = useCallback(
    (text: string) => {
      if (isEnglish && text) return ENGLISH_LABELS[text] ?? text;
      return isTraditional && text ? translateToTraditional(text) : text;
    },
    // converterReady 变化时换一个函数标识，促使使用方重译
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEnglish, isTraditional, converterReady],
  );

  const value = useMemo(
    () => ({ isEnglish, isTraditional, setIsTraditional, translate }),
    [isEnglish, isTraditional, translate],
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
