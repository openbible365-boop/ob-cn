// 账号密码登录的回归测试。
//
// 锁住几件安全相关、改动时容易被破坏的事：
//   1. 登录名大小写不敏感，邮箱也能登录
//   2. 账号不存在与密码错误返回同一句提示，不泄露账号是否存在
//   3. 失败超限后锁定，即使随后输入正确密码也拒绝
//   4. 返回给前端的用户对象里没有密码哈希
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PASSWORD = "correct-horse-1";
const HASH = bcrypt.hashSync(PASSWORD, 4);

const baseUser = {
  id: "user-1",
  name: "TestUser",
  email: "tester@example.com",
  avatarColor: "#FFD465",
  tier: "BASIC_FREE" as const,
  tierPriceCents: 0,
  status: "ACTIVE" as const,
  banReason: null as string | null,
};

const db = {
  userPassword: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db }));

const { verifyPasswordLogin } = await import("../src/lib/password-login");

let ipCounter = 0;
function freshIp() {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.userPassword.findUnique.mockImplementation(({ where }: { where: { loginName: string } }) =>
    where.loginName === "testuser"
      ? Promise.resolve({ userId: baseUser.id, loginName: "testuser", passwordHash: HASH, user: { ...baseUser } })
      : Promise.resolve(null),
  );
  db.user.findUnique.mockImplementation(({ where }: { where: { email: string } }) =>
    where.email === baseUser.email
      ? Promise.resolve({ ...baseUser, password: { userId: baseUser.id, loginName: "testuser", passwordHash: HASH } })
      : Promise.resolve(null),
  );
  db.user.update.mockResolvedValue({});
});

describe("账号密码登录", () => {
  it("登录名大小写不敏感", async () => {
    const result = await verifyPasswordLogin("  TestUser ", PASSWORD, freshIp());
    expect(result.ok).toBe(true);
  });

  it("可以用绑定的邮箱登录", async () => {
    const result = await verifyPasswordLogin("Tester@Example.com", PASSWORD, freshIp());
    expect(result.ok).toBe(true);
  });

  it("账号不存在与密码错误给出同一句提示", async () => {
    const wrongPassword = await verifyPasswordLogin("testuser", "nope-nope", freshIp());
    const unknownAccount = await verifyPasswordLogin("ghost", PASSWORD, freshIp());
    expect(wrongPassword).toEqual({ ok: false, message: "账号或密码不正确" });
    expect(unknownAccount).toEqual(wrongPassword);
  });

  it("连续失败超限后锁定，正确密码也被拒绝", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      await verifyPasswordLogin("locked-user", "wrong-pass", ip);
    }
    const result = await verifyPasswordLogin("testuser", PASSWORD, ip);
    expect(result).toEqual({ ok: false, message: "尝试次数过多，请 15 分钟后再试" });
  });

  it("封禁账号不能登录", async () => {
    db.userPassword.findUnique.mockResolvedValueOnce({
      userId: baseUser.id,
      loginName: "testuser",
      passwordHash: HASH,
      user: { ...baseUser, status: "BANNED", banReason: "违规" },
    });
    const result = await verifyPasswordLogin("testuser", PASSWORD, freshIp());
    expect(result.ok).toBe(false);
  });

  it("返回的用户对象不含密码哈希", async () => {
    const result = await verifyPasswordLogin("testuser", PASSWORD, freshIp());
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(HASH);
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });
});
