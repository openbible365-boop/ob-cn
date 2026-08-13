"use client";

import { useState } from "react";
import { updateApiKey } from "@/lib/actions/ai";

export function ApiKeyControl({
  modelId,
  apiKeyLast4,
  apiKeyUpdatedAt,
}: {
  modelId: string;
  apiKeyLast4: string | null;
  apiKeyUpdatedAt: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
        {apiKeyLast4 ? `•••• ${apiKeyLast4}` : "未配置"}
        {apiKeyUpdatedAt ? ` · 更新于 ${apiKeyUpdatedAt}` : ""}
      </div>
      {open ? (
        <form
          action={updateApiKey}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          onSubmit={() => setOpen(false)}
        >
          <input type="hidden" name="modelId" value={modelId} />
          <input
            name="newKey"
            type="password"
            placeholder="输入新的 API Key"
            required
            autoFocus
            style={{ height: 28, fontSize: 12, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, width: 160 }}
          />
          <button type="submit" className="action-purple">保存</button>
          <button type="button" className="action-body" onClick={() => setOpen(false)}>取消</button>
        </form>
      ) : (
        <button
          type="button"
          style={{
            display: "flex", alignItems: "center", height: 32, padding: "0 14px", background: "var(--white)",
            border: "1px solid var(--line)", borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
          onClick={() => setOpen(true)}
        >
          管理 API Key
        </button>
      )}
    </div>
  );
}
