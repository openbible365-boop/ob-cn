// Web AI 底座：语言推断 / 宽松 JSON 解析 / 限流 / 书名
import { describe, expect, it } from "vitest";
import {
  bookLabel,
  checkWebAiRate,
  clientKey,
  langOfVersion,
  parseJsonLoose,
} from "@/lib/web-ai";

describe("langOfVersion", () => {
  it("按译本推断语言", () => {
    expect(langOfVersion("cuv")).toBe("zh");
    expect(langOfVersion("kjv")).toBe("en");
    expect(langOfVersion("krv")).toBe("ko");
    expect(langOfVersion("keb")).toBe("ko");
    expect(langOfVersion(null)).toBe("zh");
  });
});

describe("bookLabel", () => {
  it("三语书名", () => {
    expect(bookLabel("gen", "zh")).toBe("创世记");
    expect(bookLabel("gen", "en")).toBe("Genesis");
    expect(bookLabel("gen", "ko")).toBe("창세기");
  });
  it("未知代码原样返回", () => {
    expect(bookLabel("nope", "zh")).toBe("nope");
  });
});

describe("parseJsonLoose", () => {
  it("剥掉 markdown 围栏", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("截取首尾大括号之间", () => {
    expect(parseJsonLoose('前言 {"a":1} 后记')).toEqual({ a: 1 });
  });
  it("解析失败返回 null 而不是抛错", () => {
    expect(parseJsonLoose("完全不是 JSON")).toBeNull();
    expect(parseJsonLoose('{"broken":')).toBeNull();
  });
});

describe("checkWebAiRate", () => {
  it("匿名 4 次/分，超过被拒", () => {
    const key = `ip:test-${Math.random()}`;
    for (let i = 0; i < 4; i++) expect(checkWebAiRate(key, false)).toBe(true);
    expect(checkWebAiRate(key, false)).toBe(false);
  });
  it("登录用户 12 次/分", () => {
    const key = `u:test-${Math.random()}`;
    for (let i = 0; i < 12; i++) expect(checkWebAiRate(key, true)).toBe(true);
    expect(checkWebAiRate(key, true)).toBe(false);
  });
});

describe("clientKey", () => {
  it("登录用户按 id，匿名按 x-forwarded-for 首段", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req, "u1")).toBe("u:u1");
    expect(clientKey(req, null)).toBe("ip:1.2.3.4");
    expect(clientKey(new Request("http://x/"), null)).toBe("ip:local");
  });
});
