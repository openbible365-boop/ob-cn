import type { ReactNode } from "react";

/**
 * 列表/面板的四种状态，统一在这里表达，避免各页自己拼 div。
 *
 * 原先全站只有 6/17 个页面写了空状态，文案还各不相同（「暂无注释」
 * 「暂无评论」…），且大多没有引导——用户看到空白不知道下一步做什么。
 */

/** 空状态：标题说清「空的是什么」，引导说清「怎样才会有」，必要时给动作 */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="state state-empty" role="status">
      {icon && <div className="state-icon" aria-hidden="true">{icon}</div>}
      <div className="state-title">{title}</div>
      {hint && <p className="state-hint">{hint}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

/** 错误态：说清哪里出错 + 给重试路径，不要只丢一句「加载失败」 */
export function ErrorState({
  title = "加载失败",
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-title">{title}</div>
      {hint && <p className="state-hint">{hint}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

/** 加载态：骨架屏而非转圈——保持版面高度稳定，不产生跳动 */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="state-skeleton" role="status" aria-label="正在加载">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-row">
          {Array.from({ length: columns }).map((_, c) => (
            <span key={c} className="skeleton-bar" style={{ width: `${[70, 45, 55, 35][c % 4]}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
