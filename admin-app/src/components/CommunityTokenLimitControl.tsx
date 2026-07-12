"use client";

import { useState } from "react";
import { updateCommunityTokenLimit } from "@/lib/actions/ai";

export function CommunityTokenLimitControl({
  communityId,
  limit,
}: {
  communityId: string;
  limit: number | null;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="action-purple" onClick={() => setOpen(true)}>
        改限额{limit != null ? `（当前 ${limit / 1000}K）` : ""}
      </button>
    );
  }

  return (
    <form
      action={updateCommunityTokenLimit}
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="communityId" value={communityId} />
      <input
        name="limit"
        type="number"
        placeholder="每日上限（token）"
        defaultValue={limit ?? ""}
        autoFocus
        style={{ height: 22, fontSize: 11, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, width: 110 }}
      />
      <button type="submit" className="action-purple">保存</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
