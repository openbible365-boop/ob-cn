"use client";

import { useState } from "react";
import { createPromptVersion } from "@/lib/actions/ai";

export function CreatePromptVersionControl() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          marginLeft: "auto", display: "flex", alignItems: "center", height: 32, padding: "0 14px",
          background: "var(--purple)", borderRadius: 100, fontSize: 12, fontWeight: 700, color: "#fff",
          boxShadow: "var(--shadow-card)", cursor: "pointer",
        }}
      >
        新建版本
      </div>
    );
  }

  return (
    <form
      action={createPromptVersion}
      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
      onSubmit={() => setOpen(false)}
    >
      <input
        name="version"
        placeholder="版本号，如 v3.3"
        required
        style={{ height: 28, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 100 }}
      />
      <input
        name="description"
        placeholder="说明"
        required
        style={{ height: 28, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 200 }}
      />
      <button
        type="submit"
        style={{ height: 28, padding: "0 12px", background: "var(--purple)", border: "none", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        创建
      </button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
