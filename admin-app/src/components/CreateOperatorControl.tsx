"use client";

import { useState } from "react";
import { createOperator } from "@/lib/actions/operators";

export function CreateOperatorControl() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginLeft: "auto", display: "flex", alignItems: "center", height: 32, padding: "0 14px",
          background: "var(--purple)", border: "none", borderRadius: 100, fontSize: 12, fontWeight: 700,
          color: "#fff", cursor: "pointer", boxShadow: "var(--shadow-card)",
        }}
      >
        新建运营账号
      </button>
    );
  }

  return (
    <form
      action={createOperator}
      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
      onSubmit={() => setOpen(false)}
    >
      <input name="username" placeholder="用户名" required style={{ height: 30, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 100 }} />
      <input name="name" placeholder="姓名" required style={{ height: 30, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 100 }} />
      <input name="password" type="password" placeholder="密码（≥8位）" required style={{ height: 30, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 130 }} />
      <select name="role" defaultValue="MODERATOR" style={{ height: 30, fontSize: 12, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 8 }}>
        <option value="MODERATOR">内容审核员</option>
        <option value="SUPER_ADMIN">超级管理员</option>
      </select>
      <button type="submit" style={{ height: 30, padding: "0 12px", background: "var(--purple)", border: "none", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>创建</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
