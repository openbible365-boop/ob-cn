"use client";

import { useState, useRef } from "react";
import { addNote } from "@/lib/actions/site/reading";

export function NoteComposer({
  book,
  chapter,
  verse,
}: {
  book: string;
  chapter: number;
  verse: number | string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        笔记
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addNote(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}
    >
      <input type="hidden" name="book" value={book} />
      <input type="hidden" name="chapter" value={chapter} />
      <input type="hidden" name="verse" value={verse} />
      <input
        name="content"
        placeholder="写下你的笔记…"
        required
        autoFocus
        style={{ flex: 1, height: 30, fontSize: 12, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8 }}
      />
      <button type="submit" style={{ height: 30, padding: "0 12px", background: "var(--purple)", border: "none", borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>保存</button>
      <button type="button" className="action-body" onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>取消</button>
    </form>
  );
}
