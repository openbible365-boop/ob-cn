import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function UnifiedHeader({
  title,
  subtitle,
  ariaLabel,
  onBack,
  backLabel = "返回",
  actions,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  ariaLabel: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}) {
  const titleContent = (
    <span className="unified-header-title">
      {onBack && <Icon name="chevron-left" size={14} />}
      <span>{title}</span>
    </span>
  );

  return (
    <div className="bible-toolbar unified-header">
      <div className="bible-reader-selectors" aria-label={ariaLabel}>
        {onBack ? (
          <button
            type="button"
            className="bible-reader-selector chapter"
            // 可见文字是页面标题，无障碍名称必须包含它（label-in-name），
            // 再补返回语义，读屏听到的是「祷告清单，返回我的」
            aria-label={typeof title === "string" ? `${title}，${backLabel}` : backLabel}
            onClick={onBack}
          >
            {titleContent}
          </button>
        ) : (
          <div className="bible-reader-selector chapter">{titleContent}</div>
        )}
        {/* 副标题不可点：不再长成「译本切换」那种金色芯片，降为纯文字说明 */}
        <div className="bible-reader-selector version is-static">{subtitle}</div>
      </div>
      {actions && <div className="bible-toolbar-actions">{actions}</div>}
    </div>
  );
}
