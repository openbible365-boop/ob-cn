import type { ReactNode } from "react";

/**
 * 后台通用原子组件。
 *
 * 命名一律按「语义」而非「颜色」：原先是 pill-purple / pill-pink /
 * action-orange，改配色就得全站搜替换，且看代码读不出这个标签是什么意思。
 */

export type Tone = "neutral" | "ok" | "warn" | "err" | "info";

/** 状态标签。高饱和色只在这里出现，且只表达状态。 */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** 关键数字：后台看数据优先，数值用等宽数字对齐，便于纵向比较 */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ` is-${tone}` : ""}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/** 页面骨架：标题 + 计数说明 + 右侧工具区，所有列表页共用同一节奏 */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        <h1>{title}</h1>
        {meta && <div className="page-head-meta">{meta}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}

/** 内容分区：把长页面切成有呼吸感的块，标题可选 */
export function Section({
  title,
  hint,
  actions,
  children,
}: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      {(title || actions) && (
        <div className="section-head">
          <div>
            {title && <h2>{title}</h2>}
            {hint && <p className="section-hint">{hint}</p>}
          </div>
          {actions && <div className="section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** 卡片容器：内容区的基本承载单元 */
export function Card({
  children,
  padded = true,
  className = "",
}: {
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return <div className={`ui-card${padded ? " is-padded" : ""} ${className}`.trim()}>{children}</div>;
}
