// 祷告墙：全站弟兄姊妹的代祷请求。读取公开；发布与「阿们」需登录。
import { apiRequest } from "./api";

export type WallPrayer = {
  id: string;
  content: string;
  createdAt: string;
  amenCount: number;
  amenByMe: boolean;
  author: { name: string; avatarColor: string };
};

type WallResponse = { ok: boolean; loggedIn?: boolean; prayers?: WallPrayer[]; message?: string };

export async function fetchPrayerWall(): Promise<
  { ok: true; loggedIn: boolean; prayers: WallPrayer[] } | { ok: false; message: string }
> {
  const response = await apiRequest<WallResponse>("/api/mobile/prayer-wall");
  if (!response.ok || !response.data?.ok) {
    return { ok: false, message: response.data?.message ?? "祷告墙加载失败，请稍后再试" };
  }
  return { ok: true, loggedIn: Boolean(response.data.loggedIn), prayers: response.data.prayers ?? [] };
}

export async function postWallPrayer(content: string): Promise<
  | { ok: true; prayer: WallPrayer }
  | { ok: true; pending: true; message: string }
  | { ok: false; status: number; message: string }
> {
  const response = await apiRequest<{ ok: boolean; prayer?: WallPrayer; pending?: boolean; message?: string }>(
    "/api/mobile/prayer-wall",
    { method: "POST", body: { action: "create", content } },
  );
  // 命中待审敏感词：已提交，但要等后台审核通过才上墙
  if (response.ok && response.data?.ok && response.data.pending) {
    return { ok: true, pending: true, message: response.data.message ?? "已提交，审核通过后会贴上祷告墙" };
  }
  if (!response.ok || !response.data?.ok || !response.data.prayer) {
    return { ok: false, status: response.status, message: response.data?.message ?? "发布失败，请稍后再试" };
  }
  return { ok: true, prayer: response.data.prayer };
}

export async function toggleWallAmen(postId: string): Promise<
  { ok: true; amenByMe: boolean; amenCount: number } | { ok: false; status: number; message: string }
> {
  const response = await apiRequest<{ ok: boolean; amenByMe?: boolean; amenCount?: number; message?: string }>(
    "/api/mobile/prayer-wall",
    { method: "POST", body: { action: "amen", postId } },
  );
  if (!response.ok || !response.data?.ok) {
    return { ok: false, status: response.status, message: response.data?.message ?? "操作失败，请稍后再试" };
  }
  return { ok: true, amenByMe: Boolean(response.data.amenByMe), amenCount: response.data.amenCount ?? 0 };
}
