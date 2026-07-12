"use client";

import { useState } from "react";
import { resetOperatorPassword } from "@/lib/actions/operators";

export function ResetPasswordControl({ operatorId }: { operatorId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="action-body" onClick={() => setOpen(true)}>
        重置密码
      </button>
    );
  }

  return (
    <form
      action={resetOperatorPassword}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="operatorId" value={operatorId} />
      <input
        name="password"
        type="password"
        placeholder="新密码（≥8位）"
        required
        autoFocus
        style={{ height: 24, fontSize: 11, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, width: 120 }}
      />
      <button type="submit" className="action-purple">保存</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}
