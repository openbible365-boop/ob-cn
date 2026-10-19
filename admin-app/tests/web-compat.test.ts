// 网页兼容层：书卷代码规范化 + 从仓库 data/ 读真实经文
import { describe, expect, it } from "vitest";
import { chapterVerses, normalizeBookCode } from "@/lib/web-compat";

describe("normalizeBookCode", () => {
  it("历史缩写映射到标准代码", () => {
    expect(normalizeBookCode("joh")).toBe("jhn");
    expect(normalizeBookCode("matt")).toBe("mat");
    expect(normalizeBookCode("sos")).toBe("sng");
  });
  it("大小写与空白容错", () => {
    expect(normalizeBookCode(" GEN ")).toBe("gen");
  });
});

describe("chapterVerses（真实数据）", () => {
  it("创世记 1 章有 31 节且含小标题", async () => {
    const verses = await chapterVerses("cuv", "gen", 1);
    expect(verses.length).toBe(31);
    expect(verses[0]).toMatchObject({ verse: 1 });
    expect(verses[0].text).toContain("起初");
    expect(verses.some((v) => v.heading)).toBe(true);
  });
  it("不存在的章返回空数组而不是抛错", async () => {
    expect(await chapterVerses("cuv", "gen", 999)).toEqual([]);
    expect(await chapterVerses("cuv", "zzz", 1)).toEqual([]);
  });
});
