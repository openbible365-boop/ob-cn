import { useState } from "react";
import { Icon } from "./Icon";
import { useSettings } from "../context/SettingsContext";

// 首启三步引导：只出现一次（ob.onboarding.v1），随时可跳过。
// 不做遮罩箭头那套——书感产品里一张安静的卡片，比满屏游标更得体。
const STEPS = [
  {
    icon: "book",
    title: "像读一本书",
    body: "顶部芯片切换书卷、章节与译本，左右滑动即可翻章；右上角 AA 调节字号。",
  },
  {
    icon: "edit",
    title: "轻点经文",
    body: "点任意一节，可以高亮、写笔记、查精读本注释，或交给慧读 AI 深读这节经文。",
  },
  {
    icon: "logo",
    title: "慧读圣经",
    body: "「我的」里可切换浅色、护眼、深色主题；读经位置会自动记住，下次翻开就是上次读到的地方。",
  },
] as const;

// 品牌 logo（与「我的」页、应用图标同一套：书页金 + 星芒）
function BrandLogo() {
  return (
    <svg viewBox="0 0 120 120" width="34" height="34" aria-hidden="true">
      <polygon points="60,9 63.2,15.8 72,19 63.2,22.2 60,31 56.8,22.2 48,19 56.8,15.8" fill="#E89A2C" />
      <polygon points="43.6,25.6 45.5,30.1 50,32 45.5,33.9 43.6,38.4 41.7,33.9 37.2,32 41.7,30.1" fill="currentColor" />
      <polygon points="77.9,23.6 79.8,28.1 84.3,30 79.8,31.9 77.9,36.4 76,31.9 71.5,30 76,28.1" fill="currentColor" />
      <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <line x1="60" y1="53" x2="60" y2="88" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}

const GUIDE_KEY = "ob.onboarding.v1";

export function shouldShowFirstRunGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === null;
  } catch {
    return false;
  }
}

export function FirstRunGuide({ onClose }: { onClose: () => void }) {
  const { translate } = useSettings();
  const [step, setStep] = useState(0);

  const finish = () => {
    try { localStorage.setItem(GUIDE_KEY, "done"); } catch { /* 存不了就只跳过本次 */ }
    onClose();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="first-run-layer" role="dialog" aria-modal="true" aria-label={translate("欢迎使用慧读圣经")}>
      <div className="first-run-scrim" onClick={finish} />
      <div className="first-run-card">
        <span className="first-run-icon" aria-hidden="true">
          {current.icon === "logo" ? <BrandLogo /> : <Icon name={current.icon} size={26} />}
        </span>
        <h2>{translate(current.title)}</h2>
        <p>{translate(current.body)}</p>
        <div className="first-run-dots" aria-hidden="true">
          {STEPS.map((item, index) => <i key={item.title} className={index === step ? "active" : ""} />)}
        </div>
        <div className="first-run-actions">
          <button type="button" className="first-run-skip" onClick={finish}>{translate("跳过")}</button>
          <button type="button" className="first-run-next" onClick={() => (isLast ? finish() : setStep(step + 1))}>
            {translate(isLast ? "开始读经" : "下一步")}
          </button>
        </div>
      </div>
    </div>
  );
}
