import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const destroySession = vi.fn();

const tx = {
  feedback: { updateMany: vi.fn() },
  verificationCode: { deleteMany: vi.fn() },
  community: { updateMany: vi.fn() },
  post: { deleteMany: vi.fn(), updateMany: vi.fn() },
  user: { delete: vi.fn() },
  postComment: { groupBy: vi.fn() },
  postLike: { groupBy: vi.fn() },
  eventSignup: { groupBy: vi.fn() },
  event: { updateMany: vi.fn() },
};

const db = {
  user: { findUnique: vi.fn() },
  communityResource: { findMany: vi.fn() },
  postComment: { findMany: vi.fn() },
  postLike: { findMany: vi.fn() },
  eventSignup: { findMany: vi.fn() },
  post: { findMany: vi.fn() },
  $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
};

vi.mock("@/lib/current-user", () => ({ getSessionUser, destroySession }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/apple", () => ({
  appleIosClientId: vi.fn(() => "com.openbible.live"),
  exchangeAppleNativeCode: vi.fn(),
  revokeAppleToken: vi.fn(),
  verifyAppleIdToken: vi.fn(),
}));

const { DELETE } = await import("../src/app/api/mobile/me/route");

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "user-1" });
  db.user.findUnique.mockResolvedValue({
    email: "reader@example.com",
    avatarUrl: null,
    authAccounts: [],
  });
  db.communityResource.findMany.mockResolvedValue([]);
  db.postComment.findMany.mockResolvedValue([]);
  db.postLike.findMany.mockResolvedValue([]);
  db.eventSignup.findMany.mockResolvedValue([]);
  db.post.findMany.mockResolvedValue([]);
  tx.feedback.updateMany.mockResolvedValue({ count: 1 });
  tx.verificationCode.deleteMany.mockResolvedValue({ count: 1 });
  tx.community.updateMany.mockResolvedValue({ count: 0 });
  tx.post.deleteMany.mockResolvedValue({ count: 0 });
  tx.user.delete.mockResolvedValue({ id: "user-1" });
});

function deleteRequest(body: unknown) {
  return new Request("http://localhost/api/mobile/me", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("删除用户账号", () => {
  it("拒绝未登录请求", async () => {
    getSessionUser.mockResolvedValue(null);
    const response = await DELETE(deleteRequest({ confirmation: "DELETE" }));
    expect(response.status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("要求输入精确的 DELETE 二次确认", async () => {
    const response = await DELETE(deleteRequest({ confirmation: "delete" }));
    expect(response.status).toBe(400);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("匿名化反馈、删除用户及其关联内容并注销会话", async () => {
    const response = await DELETE(deleteRequest({ confirmation: "DELETE" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(tx.feedback.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { userId: null, userEmail: null, userName: null, contact: null },
    });
    expect(tx.verificationCode.deleteMany).toHaveBeenCalledWith({
      where: { email: "reader@example.com" },
    });
    expect(tx.post.deleteMany).toHaveBeenCalledWith({ where: { authorId: "user-1" } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(destroySession).toHaveBeenCalledOnce();
  });
});
