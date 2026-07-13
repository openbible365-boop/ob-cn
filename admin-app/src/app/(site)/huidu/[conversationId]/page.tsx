import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { HuiduBlock } from "@/lib/huidu";
import { FollowupComposer } from "@/components/site/FollowupComposer";

export default async function HuiduThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const user = await getCurrentUser();

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation || conversation.userId !== user.id) notFound();

  const rounds = Math.ceil(conversation.messages.length / 2);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--surface)" }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 28px", background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
        <Link href="/huidu" className="icon-btn" style={{ width: 40, height: 40, textDecoration: "none" }}>‹</Link>
        <div style={{ fontSize: 17, fontWeight: 800 }}>慧读</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>第 {rounds} 轮 · 上下文已保留</div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* pinned quote */}
          <div style={{ background: "var(--yellow)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--ink)", color: "#fff", padding: "3px 6px", borderRadius: 12 }}>经文引用</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{conversation.verseRefLabel} · 和合本</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.75, color: "var(--ink)" }}>{conversation.verseText}</div>
          </div>

          {conversation.messages.map((m) => {
            if (m.role === "USER") {
              return (
                <div key={m.id} style={{ alignSelf: "flex-end", maxWidth: "78%", background: "var(--ink)", color: "#fff", borderRadius: 12, padding: "9px 12px", fontSize: 14, fontWeight: 600, lineHeight: 1.6, boxShadow: "var(--shadow-card)" }}>
                  {m.content}
                </div>
              );
            }
            const blocks = (m.blocks as HuiduBlock[] | null) ?? null;
            return (
              <div key={m.id} className="card" style={{ padding: 14 }}>
                {blocks ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {blocks.map((b, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", background: b.color, color: b.dark ? "#fff" : "var(--ink)", border: "1px solid var(--line)", borderRadius: 12, padding: "3px 8px" }}>{b.tag}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500, textWrap: "pretty" }}>{b.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {m.content.split("\n\n").map((para, i) => (
                      <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--body)", fontWeight: 500, textWrap: "pretty" }}>{para}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--body)", padding: "2px 12px" }}>AI 解释仅供参考，不替代教会教导与权威释经</div>
        </div>
      </div>

      <div style={{ flex: "none", background: "var(--white)", borderTop: "1px solid var(--line)", padding: "12px 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <FollowupComposer conversationId={conversation.id} />
        </div>
      </div>
    </div>
  );
}
