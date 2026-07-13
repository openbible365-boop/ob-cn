"use client";

import { useRef } from "react";
import { askFollowup } from "@/lib/actions/site/huidu";

export function FollowupComposer({ conversationId }: { conversationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await askFollowup(formData);
        formRef.current?.reset();
      }}
      style={{ display: "flex", gap: 10, alignItems: "center" }}
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input
        name="question"
        placeholder="继续追问这节经文…"
        required
        style={{ flex: 1, height: 46, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontWeight: 500 }}
      />
      <button
        type="submit"
        style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, background: "var(--purple)", border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", boxShadow: "var(--shadow-card)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
      </button>
    </form>
  );
}
