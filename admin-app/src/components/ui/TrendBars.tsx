// 每日趋势柱状图（数据看板、阅读统计共用）。悬停柱子显示当天数值。
export function TrendBars({ title, values, dayKeys, color, unit }: {
  title: string;
  values: number[];
  dayKeys: string[];
  color: string;
  unit: string;
}) {
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <strong style={{ fontSize: 13, color: "var(--ink)" }}>{title}</strong>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>近 {values.length} 天共 {total} {unit}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 96 }} role="img" aria-label={`${title}，近 ${values.length} 天共 ${total} ${unit}`}>
        {values.map((value, index) => (
          <div
            key={dayKeys[index]}
            title={`${dayKeys[index]}：${value} ${unit}`}
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
          >
            <div
              style={{
                height: `${Math.max(value ? 6 : 2, (value / max) * 100)}%`,
                background: value ? color : "var(--surface-2)",
                borderRadius: "4px 4px 2px 2px",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
        <span>{dayKeys[0]?.slice(5)}</span>
        <span>今天</span>
      </div>
    </div>
  );
}

