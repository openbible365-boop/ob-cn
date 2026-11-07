import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { Badge } from "@/components/ui/Primitives";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteConversation } from "@/lib/actions/ai-records";
import { formatDateTime } from "@/lib/format";

type Block = { tag?: unknown; text?: unknown };
type Source = { kind?: unknown; label?: unknown; title?: unknown; ref?: unknown };

function readPayload(value: unknown) {
  const payload = value && typeof value === "object" ? (value as { blocks?: unknown; sources?: unknown }) : null;
  const blocks = Array.isArray(payload?.blocks)
    ? (payload.blocks as Block[]).filter((block) => typeof block?.text === "string" && block.text)
    : [];
  const sources = Array.isArray(payload?.sources) ? (payload.sources as Source[]) : [];
  return { blocks, sources };
}

function sourceLabel(source: Source) {
  for (const value of [source.label, source.title, source.ref]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

const SOURCE_KIND: Record<string, string> = { scripture: "经文", commentary: "注释", community: "社群" };

export default async function AiRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  const { id } = await params;
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, uid: true, email: true, avatarColor: true, avatarUrl: true } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!conversation) notFound();

  // 查看用户的私人对话内容要留痕
  await logAudit({
    operatorId: session.user.id,
    action: "查看慧读对话",
    targetType: "Conversation",
    targetId: conversation.id,
    detail: `用户 ${conversation.user.name}（UID ${conversation.user.uid}）· ${conversation.title.slice(0, 40)}`,
  });

  const isScripture = Boolean(conversation.book);
  const questions = conversation.messages.filter((message) => message.role === "USER").length;

  return (
    <>
      <div className="admin-header">
        <Link href="/admin/ai-records" style={{ color: "var(--body)", fontSize: 13, fontWeight: 600 }}>← AI 对话记录</Link>
        <div style={{ flex: 1 }} />
        <form action={deleteConversation}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="returnTo" value="list" />
          <ConfirmSubmitButton className="action-pink" confirmMessage="删除这段对话？用户各设备上的这条记录也会在下次同步时消失，无法恢复。">
            删除对话
          </ConfirmSubmitButton>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 16, alignItems: "start" }}>
        <section className="card" style={{ borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Badge tone={isScripture ? "info" : "neutral"}>{isScripture ? "经文解读" : "自由提问"}</Badge>
            {isScripture && conversation.verseRefLabel ? (
              <span style={{ color: "var(--yellow-ink)", fontSize: 13, fontWeight: 700 }}>{conversation.verseRefLabel}</span>
            ) : null}
          </div>
          <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{conversation.title}</h1>

          {isScripture && conversation.verseText ? (
            <blockquote style={{
              margin: "0 0 18px", padding: "12px 14px", borderLeft: "3px solid var(--yellow)",
              borderRadius: 10, background: "var(--yellow-soft)", color: "var(--ink)", fontSize: 14, lineHeight: 1.8,
            }}>
              {conversation.verseText}
            </blockquote>
          ) : null}

          {conversation.messages.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>这段对话还没有内容。</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {conversation.messages.map((message) => {
                const { blocks, sources } = readPayload(message.blocks);
                if (message.role === "USER") {
                  return (
                    <div key={message.id} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginBottom: 4 }}>用户提问</div>
                      <div style={{
                        padding: "10px 14px", borderRadius: "14px 14px 4px 14px", background: "var(--surface-2)",
                        color: "var(--ink)", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {message.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={message.id} style={{ maxWidth: "92%" }}>
                    <div style={{ fontSize: 11, color: "var(--purple)", fontWeight: 700, marginBottom: 4 }}>慧读回答</div>
                    <div style={{
                      padding: "12px 16px", borderRadius: "14px 14px 14px 4px", border: "1px solid var(--line)",
                      background: "var(--white)", color: "var(--ink)", fontSize: 14, lineHeight: 1.8, wordBreak: "break-word",
                    }}>
                      {blocks.length > 0 ? (
                        blocks.map((block, index) => (
                          <div key={index} style={{ marginTop: index ? 12 : 0 }}>
                            {typeof block.tag === "string" && block.tag ? (
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--purple-deep)", marginBottom: 2 }}>{block.tag}</div>
                            ) : null}
                            <div style={{ whiteSpace: "pre-wrap" }}>{String(block.text)}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                      )}
                      {sources.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
                          <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center" }}>参考来源</span>
                          {sources.map((source, index) => {
                            const label = sourceLabel(source);
                            if (!label) return null;
                            const kindLabel = typeof source.kind === "string" ? SOURCE_KIND[source.kind] : undefined;
                            return (
                              <span key={index} style={{
                                fontSize: 11, padding: "2px 8px", borderRadius: 100,
                                background: "var(--purple-soft)", color: "var(--purple-deep)",
                              }}>
                                {kindLabel ? `${kindLabel} · ` : ""}{label}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="card" style={{ borderRadius: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="user-cell">
            <UserAvatar name={conversation.user.name} avatarColor={conversation.user.avatarColor} avatarUrl={conversation.user.avatarUrl} />
            <div className="user-cell-text">
              <div className="user-cell-name">{conversation.user.name}</div>
              <div className="user-cell-sub">UID {conversation.user.uid}</div>
            </div>
          </div>
          <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 13 }}>
            {[
              ["邮箱", conversation.user.email || "—"],
              ["创建时间", formatDateTime(conversation.createdAt)],
              ["提问次数", `${questions} 次`],
              ["消息条数", `${conversation.messages.length} 条`],
              ...(conversation.translation ? [["译本", conversation.translation.toUpperCase()]] : []),
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <dt style={{ color: "var(--muted)" }}>{label}</dt>
                <dd style={{ margin: 0, color: "var(--ink)", fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{value}</dd>
              </div>
            ))}
          </dl>
          <Link href={`/admin/ai-records?q=${encodeURIComponent(conversation.user.email || conversation.user.name)}`} style={{ fontSize: 12, color: "var(--purple)", fontWeight: 600 }}>
            查看该用户的全部对话 →
          </Link>
        </aside>
      </div>
    </>
  );
}
