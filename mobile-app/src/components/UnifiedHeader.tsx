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
            aria-label={backLabel}
            onClick={onBack}
          >
            {titleContent}
          </button>
        ) : (
          <div className="bible-reader-selector chapter">{titleContent}</div>
        )}
        <div className="bible-reader-selector version">{subtitle}</div>
      </div>
      {actions && <div className="bible-toolbar-actions">{actions}</div>}
    </div>
  );
}
