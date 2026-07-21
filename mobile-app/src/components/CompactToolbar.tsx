import type { ReactNode } from "react";

export function CompactToolbar({
  primary,
  secondary,
  actions,
  overlay,
  onPrimaryClick,
  primaryAriaLabel,
  primaryOpen = false,
  ariaLabel,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  actions?: ReactNode;
  overlay?: ReactNode;
  onPrimaryClick?: () => void;
  primaryAriaLabel?: string;
  primaryOpen?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="bible-toolbar">
      <div className="bible-reader-selectors" aria-label={ariaLabel}>
        {onPrimaryClick ? (
          <button
            className={`bible-reader-selector chapter${primaryOpen ? " is-open" : ""}`}
            type="button"
            aria-label={primaryAriaLabel}
            aria-expanded={primaryOpen}
            onClick={onPrimaryClick}
          >
            {primary}
          </button>
        ) : (
          <div className="bible-reader-selector chapter">{primary}</div>
        )}
        <div className="bible-reader-selector version">{secondary}</div>
      </div>
      {actions && <div className="bible-toolbar-actions">{actions}</div>}
      {overlay}
    </div>
  );
}
