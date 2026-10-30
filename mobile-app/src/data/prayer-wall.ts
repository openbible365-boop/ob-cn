import { apiRequest } from "./api";
import type { WorkspacePost } from "./community-workspace";

// The personal prayer wall reads the deployed posts API without changing the
// locally maintained community workspace or its post composer.
export type PrayerWallPost = Omit<WorkspacePost, "postType"> & {
  postType: WorkspacePost["postType"] | "PRAYER";
};

export async function fetchCommunityPosts(communityId: string): Promise<
  | { ok: true; posts: PrayerWallPost[] }
  | { ok: false; message: string }
> {
  try {
    const response = await apiRequest<{
      ok: boolean;
      message?: string;
      posts?: PrayerWallPost[];
    }>(`/api/mobile/community/${encodeURIComponent(communityId)}/posts`);
    const data = response.data;
    if (!response.ok || !data?.ok || !Array.isArray(data.posts)) {
      return { ok: false, message: data?.message ?? "代祷动态加载失败，请稍后重试" };
    }
    return { ok: true, posts: data.posts };
  } catch {
    return { ok: false, message: "代祷动态加载失败，请稍后重试" };
  }
}
