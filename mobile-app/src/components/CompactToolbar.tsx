import type { ReactNode } from "react";

export function CompactToolbar({
  primary,
  secondary,
  actions,
  overlay,
  onPrimaryClick,
  onSecondaryClick,
  primaryAriaLabel,
  secondaryAriaLabel,
  primaryOpen = false,
  ariaLabel,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  actions?: ReactNode;
  overlay?: ReactNode;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  primaryAriaLabel?: string;
  secondaryAriaLabel?: string;
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
        {secondary !== undefined && (
          onSecondaryClick ? (
            <button
              className="bible-reader-selector version"
              type="button"
              aria-label={secondaryAriaLabel}
              onClick={onSecondaryClick}
            >
              {secondary}
            </button>
          ) : (
            <div className="bible-reader-selector version">{secondary}</div>
          )
        )}
      </div>
      {actions && <div className="bible-toolbar-actions">{actions}</div>}
      {overlay}
    </div>
  );
}
