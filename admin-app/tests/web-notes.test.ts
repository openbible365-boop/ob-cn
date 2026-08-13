// 跨端笔记形状翻译：网页 {ref, refs, text, date} ↔ App {book, chapter, verse, content}
import { describe, expect, it } from "vitest";
import { parseVerseRef, toStoredNote, toWebNote, verseRefLabel } from "@/lib/web-notes";

describe("parseVerseRef", () => {
  it("解析标准引用", () => {
    expect(parseVerseRef("gen-1-1")).toEqual({ book: "gen", chapter: 1, verse: 1 });
    expect(parseVerseRef("rev-22-21")).toEqual({ book: "rev", chapter: 22, verse: 21 });
  });
  it("拒绝畸形输入", () => {
    expect(parseVerseRef("gen-1")).toBeNull();
    expect(parseVerseRef("")).toBeNull();
    expect(parseVerseRef("gen-a-b")).toBeNull();
  });
});

describe("verseRefLabel", () => {
  it("用中文书名", () => {
    expect(verseRefLabel("gen", 1, 1)).toBe("创世记 1:1");
  });
  it("未知书卷回退代码", () => {
    expect(verseRefLabel("zzz", 1, 1)).toBe("zzz 1:1");
  });
});

describe("toStoredNote / toWebNote 往返", () => {
  it("网页笔记锚定到第一节", () => {
    const stored = toStoredNote(
      { id: "n1", refs: ["gen-1-3", "gen-1-4"], text: "要有光", date: "2026-08-01" },
      "fallback",
    );
    expect(stored).toMatchObject({ id: "n1", book: "gen", chapter: 1, verse: 3, content: "要有光" });
  });
  it("空正文或无经文引用返回 null（散记留在网页本地）", () => {
    expect(toStoredNote({ refs: ["gen-1-1"], text: "  " }, "f")).toBeNull();
    expect(toStoredNote({ refs: [], text: "散记" }, "f")).toBeNull();
  });
  it("无 id 时使用 fallbackId", () => {
    const stored = toStoredNote({ refs: ["jhn-3-16"], text: "神爱世人" }, "fb-123");
    expect(stored?.id).toBe("fb-123");
  });
  it("非法日期回退为当前时间而不是 Invalid Date", () => {
    const stored = toStoredNote({ refs: ["gen-1-1"], text: "x", date: "not-a-date" }, "f");
    expect(Number.isNaN(stored!.createdAt.getTime())).toBe(false);
  });
  it("stored → web 保持引用与文本", () => {
    const web = toWebNote({
      id: "n2", book: "jhn", chapter: 3, verse: 16,
      content: "神爱世人", createdAt: new Date("2026-08-06T00:00:00Z"),
    });
    expect(web).toEqual({
      id: "n2", ref: "约翰福音 3:16", refs: ["jhn-3-16"], text: "神爱世人", date: "2026-08-06",
    });
  });
});
