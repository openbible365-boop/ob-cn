"use client";

import { useState } from "react";
import { createSensitiveWord } from "@/lib/actions/content";

export function AddSensitiveWordControl() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginLeft: "auto", display: "flex", alignItems: "center", height: 30, padding: "0 12px",
          background: "var(--purple)", border: "none", borderRadius: 100, fontSize: 12, fontWeight: 700,
          color: "#fff", cursor: "pointer",
        }}
      >
        新增词条
      </button>
    );
  }

  return (
    <form
      action={createSensitiveWord}
      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
      onSubmit={() => setOpen(false)}
    >
      <input
        name="word"
        placeholder="词条"
        required
        style={{ height: 28, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 140 }}
      />
      <select
        name="level"
        defaultValue="BLOCK"
        style={{ height: 28, fontSize: 12, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 8 }}
      >
        <option value="BLOCK">拦截级</option>
        <option value="REVIEW">待审级</option>
        <option value="LOG">仅记录</option>
      </select>
      <button
        type="submit"
        style={{ height: 28, padding: "0 12px", background: "var(--purple)", border: "none", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        添加
      </button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
