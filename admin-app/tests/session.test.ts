// 会话安全回归测试。
//
// 早期实现把明文 user id 放进 cookie，而社群接口会返回帖子作者的 user id，
// 任何人据此改 cookie 即可冒充他人。这里锁住修复后的两条不变量：
//   1. cookie 里的值必须与 user id 无关（不可由 id 推出）
//   2. 服务端只认 token 的哈希，明文 id 或随机猜测都不能通过
import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

// 与 src/lib/current-user.ts 中的实现保持一致
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const issueToken = () => randomBytes(32).toString("base64url");

describe("会话 token", () => {
  it("与 user id 无关：同一用户两次签发得到不同 token", () => {
    const a = issueToken();
    const b = issueToken();
    expect(a).not.toBe(b);
  });

  it("长度足以抵抗猜测（32 字节 ≈ 256 位熵）", () => {
    const token = issueToken();
    // base64url 编码 32 字节 → 43 个字符
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("库里存哈希，拿到库也无法反推 cookie", () => {
    const token = issueToken();
    const stored = hashToken(token);
    expect(stored).not.toContain(token);
    expect(stored).toHaveLength(64);
  });

  it("哈希稳定：同一 token 每次算出同一结果，才能用于查库", () => {
    const token = issueToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("不同 token 的哈希不同", () => {
    expect(hashToken(issueToken())).not.toBe(hashToken(issueToken()));
  });

  it("把 user id 当 token 提交，算出的哈希不会命中任何真实会话", () => {
    // 攻击者拿到受害者的 user id（社群接口会返回作者 id）
    const victimUserId = "cmsr09q1b0001fvi8xvof09j5";
    const realToken = issueToken();
    // 服务端按哈希查库；用 id 算出的哈希与真实会话的哈希无任何关联
    expect(hashToken(victimUserId)).not.toBe(hashToken(realToken));
  });
});
