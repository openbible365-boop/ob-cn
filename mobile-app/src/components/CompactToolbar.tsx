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
  secondaryChip = false,
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
  /** 版本位芯片：不可点也保持芯片外观（如注释页「精读本注释」，与圣经页「和合本」同级）。
      默认 false——说明性副标题降为纯文字，芯片样式留给可点元素。 */
  secondaryChip?: boolean;
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
            // 版本位保持芯片外观；说明性副标题降为纯文字（芯片样式 = 可点的视觉承诺）
            <div className={`bible-reader-selector version${secondaryChip ? "" : " is-static"}`}>{secondary}</div>
          )
        )}
      </div>
      {actions && <div className="bible-toolbar-actions">{actions}</div>}
      {overlay}
    </div>
  );
}
