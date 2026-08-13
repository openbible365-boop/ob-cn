import type { ReactNode } from "react";

export function CompactToolbar({
  primary,
  middle,
  secondary,
  actions,
  overlay,
  onPrimaryClick,
  onMiddleClick,
  onSecondaryClick,
  primaryAriaLabel,
  middleAriaLabel,
  secondaryAriaLabel,
  primaryOpen = false,
  middleOpen = false,
  middleWide = false,
  ariaLabel,
}: {
  primary: ReactNode;
  middle?: ReactNode;
  secondary?: ReactNode;
  actions?: ReactNode;
  overlay?: ReactNode;
  onPrimaryClick?: () => void;
  onMiddleClick?: () => void;
  onSecondaryClick?: () => void;
  primaryAriaLabel?: string;
  middleAriaLabel?: string;
  secondaryAriaLabel?: string;
  primaryOpen?: boolean;
  middleOpen?: boolean;
  middleWide?: boolean;
  ariaLabel: string;
}) {
  const primaryClass = middle === undefined ? "chapter" : "book";

  return (
    <div className="bible-toolbar">
      <div className="bible-reader-selectors" aria-label={ariaLabel}>
        {onPrimaryClick ? (
          <button
            className={`bible-reader-selector ${primaryClass}${primaryOpen ? " is-open" : ""}`}
            type="button"
            aria-label={primaryAriaLabel}
            aria-expanded={primaryOpen}
            onClick={onPrimaryClick}
          >
            {primary}
          </button>
        ) : (
          <div className={`bible-reader-selector ${primaryClass}`}>{primary}</div>
        )}
        {middle !== undefined && (
          onMiddleClick ? (
            <button
              className={`bible-reader-selector chapter-number${middleWide ? " is-wide" : ""}${middleOpen ? " is-open" : ""}`}
              type="button"
              aria-label={middleAriaLabel}
              aria-expanded={middleOpen}
              onClick={onMiddleClick}
            >
              {middle}
            </button>
          ) : (
            <div className={`bible-reader-selector chapter-number${middleWide ? " is-wide" : ""}`}>
              {middle}
            </div>
          )
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
