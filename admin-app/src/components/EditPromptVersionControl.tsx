"use client";

import { useState } from "react";
import { editPromptVersion } from "@/lib/actions/ai";

export function EditPromptVersionControl({
  id,
  description,
  rolloutPercent,
}: {
  id: string;
  description: string;
  rolloutPercent: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="action-body" onClick={() => setOpen(true)}>
        编辑
      </button>
    );
  }

  return (
    <form
      action={editPromptVersion}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="description"
        defaultValue={description}
        required
        style={{ height: 24, fontSize: 11, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, width: 160 }}
      />
      <input
        name="rolloutPercent"
        type="number"
        min={0}
        max={100}
        defaultValue={rolloutPercent}
        required
        style={{ height: 24, fontSize: 11, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, width: 48 }}
      />
      <button type="submit" className="action-purple">保存</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
