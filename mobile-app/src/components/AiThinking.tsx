import { useEffect, useState } from "react";

// AI 生成中的「工作感」：星芒呼吸 + 轮换的工作动词 + 微光占位行。
// 动效受全局 prefers-reduced-motion 守卫约束。
const VERBS = ["正在研读经文…", "正在查考上下文…", "正在整理要点…"];

export function AiThinking({ label }: { label?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (label) return;
    const timer = setInterval(() => setStep((value) => value + 1), 1700);
    return () => clearInterval(timer);
  }, [label]);
  return (
    <div className="ai-thinking" role="status" aria-label="AI 正在生成回答">
      <span className="ai-thinking-head">
        <svg className="ai-thinking-spark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5c.9 5.2 3.4 7.7 8.6 8.6-5.2.9-7.7 3.4-8.6 8.6-.9-5.2-3.4-7.7-8.6-8.6 5.2-.9 7.7-3.4 8.6-8.6Z" />
        </svg>
        <span className="ai-thinking-verb">{label ?? VERBS[step % VERBS.length]}</span>
      </span>
      <span className="ai-thinking-lines" aria-hidden="true"><i /><i style={{ width: "72%" }} /></span>
    </div>
  );
}
