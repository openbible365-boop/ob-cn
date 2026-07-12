"use client";

import { useState } from "react";
import { banUser } from "@/lib/actions/users";

export function BanUserControl({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="action-pink" onClick={() => setOpen(true)}>
        封禁
      </button>
    );
  }

  return (
    <form
      action={banUser}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="userId" value={userId} />
      <input
        name="reason"
        placeholder="封禁原因"
        required
        autoFocus
        style={{
          height: 24,
          fontSize: 11,
          padding: "0 6px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          width: 100,
        }}
      />
      <button type="submit" className="action-pink">确认</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
