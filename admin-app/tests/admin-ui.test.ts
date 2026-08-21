// 后台 UI 组件层的回归测试。
//
// 锁住两件容易在改配色/改列宽时被破坏的事：
//   1. 弹性列必须包 minmax(0,…)，否则长文本撑破轨道、省略号永不触发
//   2. 状态色与其浅底的对比度必须达 WCAG AA（4.5:1）
import { describe, expect, it } from "vitest";
import { templateOf } from "../src/components/ui/gridTemplate";

describe("DataTable 列宽推导", () => {
  it("弹性列包 minmax(0,…)——不包的话长内容会撑破轨道", () => {
    expect(templateOf([{ width: "1.6fr" }])).toBe("minmax(0, 1.6fr)");
  });

  it("固定列原样保留，不必要的 minmax 只会增加解析负担", () => {
    expect(templateOf([{ width: "120px" }])).toBe("120px");
  });

  it("混合列按顺序拼成完整轨道", () => {
    expect(templateOf([{ width: "1.6fr" }, { width: "110px" }, { width: "90px" }])).toBe(
      "minmax(0, 1.6fr) 110px 90px",
    );
  });

  it("空列定义得到空串，不产生 'undefined' 之类的脏值", () => {
    expect(templateOf([])).toBe("");
  });
});

// ── 对比度：与 globals.css 里的令牌保持同步 ──
const relLum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (fg: string, bg: string) => {
  const a = relLum(fg);
  const b = relLum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe("后台配色对比度（WCAG AA ≥ 4.5:1）", () => {
  const pairs: Array<[string, string, string]> = [
    ["成功", "#1f6b45", "#eaf4ee"],
    ["告警", "#8a5507", "#fdf3e0"],
    ["错误", "#a82f52", "#fbeaef"],
    ["信息", "#2c5d8f", "#eaf1f8"],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name}标签的文字压在自己的浅底上达标`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  const onSurface: Array<[string, string]> = [
    ["--ink 主文本", "#202229"],
    ["--body 次文本", "#545b66"],
    ["--muted 辅助文本", "#6f7681"],
  ];
  for (const [name, fg] of onSurface) {
    it(`${name}压在卡片白底上达标`, () => {
      expect(contrast(fg, "#fffefc")).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("深色侧栏的白字对比度充足", () => {
    expect(contrast("#ffffff", "#202229")).toBeGreaterThanOrEqual(4.5);
  });
});
