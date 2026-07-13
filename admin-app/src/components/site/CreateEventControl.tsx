"use client";

import { useState } from "react";
import { createEvent } from "@/lib/actions/site/events";

export function CreateEventControl({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 16px",
          background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 13,
          fontWeight: 700, cursor: "pointer",
        }}
      >
        新建活动
      </button>
    );
  }

  return (
    <form
      action={createEvent}
      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="communityId" value={communityId} />
      <input name="title" placeholder="活动名称" required style={{ height: 32, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 140 }} />
      <input name="startAt" type="datetime-local" required style={{ height: 32, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8 }} />
      <input name="endAt" type="datetime-local" style={{ height: 32, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8 }} />
      <button type="submit" style={{ height: 32, padding: "0 12px", background: "var(--purple)", border: "none", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>创建</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
