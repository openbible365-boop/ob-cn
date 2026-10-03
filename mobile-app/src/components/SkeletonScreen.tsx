// 加载态骨架屏：代替一行「加载中…」文字，形状上先把页面的轮廓占住。
// variant="verses" 模拟经文段落（行宽参差），"list" 模拟列表行。
export function SkeletonScreen({
  variant = "list",
  label = "正在加载",
}: {
  variant?: "list" | "verses";
  label?: string;
}) {
  return (
    <div className={`skeleton-screen is-${variant}`} role="status" aria-label={label}>
      {variant === "verses" ? (
        <>
          <i style={{ width: "38%" }} />
          <i /><i /><i style={{ width: "92%" }} /><i /><i style={{ width: "61%" }} />
          <i /><i style={{ width: "88%" }} /><i /><i style={{ width: "45%" }} />
        </>
      ) : (
        <>
          <i style={{ width: "42%" }} /><i /><i style={{ width: "86%" }} />
          <i style={{ width: "55%" }} /><i /><i style={{ width: "70%" }} />
        </>
      )}
    </div>
  );
}
