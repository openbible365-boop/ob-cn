"use client";

import { toggleLike } from "@/lib/actions/site/community";

export function LikeButton({
  postId,
  communityId,
  likeCount,
  liked,
}: {
  postId: string;
  communityId: string;
  likeCount: number;
  liked: boolean;
}) {
  return (
    <form action={toggleLike}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="communityId" value={communityId} />
      <button
        type="submit"
        style={{
          display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer",
          color: liked ? "var(--pink)" : "var(--body)", fontSize: 12, fontWeight: 700, padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {likeCount}
      </button>
    </form>
  );
}
