// Web AI 路由级测试：未配置 LLM 时的模板降级路径（不触库、不出网）
import { beforeEach, describe, expect, it, vi } from "vitest";

// 路由里只用 getSessionUser 判断登录态；测试统一按未登录处理
vi.mock("@/lib/current-user", () => ({
  getSessionUser: async () => null,
}));

import { GET as chapterSummary } from "@/app/api/web/ai/chapter-summary/[book]/[chapter]/route";
import { POST as question } from "@/app/api/web/ai/question/route";
import { POST as tagExplain } from "@/app/api/web/ai/eval/tag-explain/route";

beforeEach(() => {
  delete process.env.OPENBIBLE_LLM_API_KEY;
  delete process.env.VLLM_API_KEY;
});

describe("GET /api/web/ai/chapter-summary", () => {
  it("降级返回小标题主题词与三个探索问题", async () => {
    const res = await chapterSummary(
      new Request("http://x/api/web/ai/chapter-summary/gen/1?version=cuv"),
      { params: Promise.resolve({ book: "gen", chapter: "1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBeNull();
    expect(body.theme_tags).toContain("神的创造");
    expect(body.explore_chips).toHaveLength(3);
    expect(body.explore_chips[0].question).toContain("创世记");
  });
  it("未知书卷返回 404", async () => {
    const res = await chapterSummary(
      new Request("http://x/api/web/ai/chapter-summary/zzz/1"),
      { params: Promise.resolve({ book: "zzz", chapter: "1" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/web/ai/question", () => {
  it("空问题返回 400", async () => {
    const res = await question(
      new Request("http://x/", { method: "POST", body: JSON.stringify({ question: "" }) }),
    );
    expect(res.status).toBe(400);
  });
  it("降级模板回答包含问题与上下文", async () => {
    const res = await question(
      new Request("http://x/", {
        method: "POST",
        headers: { "x-forwarded-for": `t-${Math.random()}` },
        body: JSON.stringify({ question: "什么是恩典？", context: "创世记 1章", version: "cuv" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toContain("什么是恩典？");
    expect(body.answer).toContain("创世记 1章");
  });
});

describe("POST /api/web/ai/eval/tag-explain", () => {
  it("降级回答保持前端约定的 1./2./3. 三段格式", async () => {
    const res = await tagExplain(
      new Request("http://x/", {
        method: "POST",
        headers: { "x-forwarded-for": `t-${Math.random()}` },
        body: JSON.stringify({ book_code: "gen", book_name: "创世记", chapter: 1, tag: "创造", version: "cuv" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const sections = body.answer.split(/\n(?=[123]\.\s)/);
    expect(sections).toHaveLength(3);
    expect(body.answer).toContain("创造");
  });
  it("缺少标签返回 400", async () => {
    const res = await tagExplain(
      new Request("http://x/", { method: "POST", body: JSON.stringify({ book_code: "gen" }) }),
    );
    expect(res.status).toBe(400);
  });
});
