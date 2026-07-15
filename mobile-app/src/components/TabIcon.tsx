export type TabIconName = "bible" | "annotations" | "huidu" | "community" | "me";

type TabIconProps = {
  name: TabIconName;
  active: boolean;
};

export function TabIcon({ name, active }: TabIconProps) {
  const sharedProps = {
    width: 26,
    height: 26,
    viewBox: "0 0 28 28",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: `tab-icon-svg tab-icon-svg-${name}`,
  };

  if (name === "bible") {
    return (
      <svg {...sharedProps}>
        <path className="tab-icon-surface" d="M3.5 5.5c3.9-1.1 7.2-.4 10.5 2v16c-3.3-2.4-6.6-3.1-10.5-2V5.5Z" />
        <path className="tab-icon-surface" d="M24.5 5.5c-3.9-1.1-7.2-.4-10.5 2v16c3.3-2.4 6.6-3.1 10.5-2V5.5Z" />
      </svg>
    );
  }

  if (name === "annotations") {
    return (
      <svg {...sharedProps}>
        <path
          className="tab-icon-surface"
          d="M5 4.5h18A2.5 2.5 0 0 1 25.5 7v12a2.5 2.5 0 0 1-2.5 2.5H12l-6.5 4v-4H5A2.5 2.5 0 0 1 2.5 19V7A2.5 2.5 0 0 1 5 4.5Z"
        />
        <path d="M8 10h12M8 15h8" />
        <circle className="tab-icon-detail" cx="20.8" cy="15" r="1" stroke="none" />
      </svg>
    );
  }

  if (name === "huidu") {
    return (
      <svg {...sharedProps}>
        <path
          className="tab-icon-surface tab-icon-sparkle-large"
          d="M11.5 3.5c.7 4.15 3.05 6.5 7.2 7.2-4.15.7-6.5 3.05-7.2 7.2-.7-4.15-3.05-6.5-7.2-7.2 4.15-.7 6.5-3.05 7.2-7.2Z"
        />
        <path
          className="tab-icon-surface tab-icon-sparkle-small"
          d="M19.1 3.2c.24 1.4 1.08 2.25 2.5 2.5-1.42.25-2.26 1.1-2.5 2.5-.25-1.4-1.1-2.25-2.5-2.5 1.4-.25 2.25-1.1 2.5-2.5Z"
        />
      </svg>
    );
  }

  if (name === "community") {
    return (
      <svg {...sharedProps}>
        <circle className="tab-icon-surface" cx="10" cy="8.4" r="3.6" />
        <circle className="tab-icon-surface" cx="20.2" cy="10.1" r="2.8" />
        <path d="M3.3 23.5c.4-5 3-7.6 6.7-7.6s6.3 2.6 6.7 7.6M17 17.5c.9-.8 2-1.2 3.3-1.2 2.9 0 4.8 2 5.2 5.8" />
      </svg>
    );
  }

  return (
    <svg {...sharedProps}>
      <circle className="tab-icon-surface" cx="14" cy="8" r="4.5" />
      <path d="M5.2 24.2c.55-5.6 3.7-8.4 8.8-8.4s8.25 2.8 8.8 8.4" />
      {active && <path className="tab-icon-active-detail" d="M19.3 18.2c.9.9 1.5 2 1.8 3.4" />}
    </svg>
  );
}
