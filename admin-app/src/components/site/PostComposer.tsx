"use client";

import { useRef } from "react";
import { createPost } from "@/lib/actions/site/community";

export function PostComposer({ communityId }: { communityId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createPost(formData);
        formRef.current?.reset();
      }}
      className="card"
      style={{ padding: "14px 16px" }}
    >
      <input type="hidden" name="communityId" value={communityId} />
      <textarea
        name="content"
        placeholder="分享此刻的领受…"
        required
        rows={2}
        style={{
          width: "100%", border: "none", outline: "none", resize: "none", fontFamily: "inherit",
          fontSize: 14, fontWeight: 500, color: "var(--ink)", padding: "4px 0 12px",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--surface-2)", paddingTop: 10 }}>
        <input
          name="verseRef"
          placeholder="经文引用（可选），如「约翰福音 3:16」"
          style={{
            flex: 1, height: 30, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8,
          }}
        />
        <button
          type="submit"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", height: 34, padding: "0 18px",
            background: "var(--purple)", borderRadius: 100, fontSize: 13, fontWeight: 700, color: "#fff",
            border: "none", boxShadow: "var(--shadow-card)", cursor: "pointer",
          }}
        >
          发布
        </button>
      </div>
    </form>
  );
}
