import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { SearchShortcut } from "@/components/ui/SearchShortcut";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteConversation } from "@/lib/actions/ai-records";
import { formatDateTime } from "@/lib/format";

// 慧读 AI 对话记录：用户在 App / 网页版与慧读的问答（登录后同步到云端）。
// 对话内容属于用户隐私：仅超级管理员可见，查看详情与删除都会写入审计日志。

const COLUMNS: Column[] = [
  { key: "user", label: "用户", width: "1.3fr" },
  { key: "title", label: "对话", width: "2.4fr" },
  { key: "kind", label: "类型", width: "96px" },
  { key: "turns", label: "提问", width: "64px", align: "right" },
  { key: "time", label: "创建时间", width: "150px" },
  { key: "ops", label: "操作", width: "130px" },
];

const KIND_TABS = [
  { key: "all", label: "全部" },
  { key: "scripture", label: "经文解读" },
  { key: "general", label: "自由提问" },
] as const;

export default async function AiRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  const { q, kind = "all", page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const keyword = q?.trim();

  const where: Prisma.ConversationWhereInput = {
    ...(kind === "scripture" ? { book: { not: "" } } : kind === "general" ? { book: "" } : {}),
    ...(keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { verseRefLabel: { contains: keyword, mode: "insensitive" } },
            { user: { name: { contains: keyword, mode: "insensitive" } } },
            { user: { email: { contains: keyword, mode: "insensitive" } } },
            { messages: { some: { role: "USER", content: { contains: keyword, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalConversations, totalQuestions, activeUsers, weekConversations, rows, listTotal] = await Promise.all([
    db.conversation.count(),
    db.message.count({ where: { role: "USER" } }),
    db.user.count({ where: { conversations: { some: {} } } }),
    db.conversation.count({ where: { createdAt: { gte: weekAgo } } }),
    db.conversation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, uid: true, email: true, avatarColor: true, avatarUrl: true } },
        _count: { select: { messages: { where: { role: "USER" } } } },
        // 列表里预览用户的第一个问题
        messages: { where: { role: "USER" }, orderBy: { createdAt: "asc" }, take: 1, select: { content: true } },
      },
      ...pageQuery(page),
    }),
    db.conversation.count({ where }),
  ]);
  const info = pageInfo(page, listTotal);

  const tabHref = (key: string) =>
    `/admin/ai-records?${new URLSearchParams({ ...(keyword ? { q: keyword } : {}), kind: key }).toString()}`;

  return (
    <>
      <SearchShortcut />
      <div className="admin-header">
        <div className="title">AI 对话记录</div>
        <div className="meta">用户与慧读的问答记录 · 仅超级管理员可见，查看与删除均记入审计</div>
        <div style={{ flex: 1 }} />
        <form className="search-box" action="/admin/ai-records">
          {kind !== "all" ? <input type="hidden" name="kind" value={kind} /> : null}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="搜索用户 / 邮箱 / 标题 / 提问内容" defaultValue={keyword ?? ""} />
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "对话总数", value: totalConversations, unit: "个", color: "var(--purple)" },
          { label: "提问总数", value: totalQuestions, unit: "次", color: "var(--purple)" },
          { label: "使用慧读的用户", value: activeUsers, unit: "人", color: "var(--ink)" },
          { label: "近 7 天新对话", value: weekConversations, unit: "个", color: "var(--ink)" },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--body)", marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, fontVariantNumeric: "tabular-nums" }}>
              {stat.value.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>{stat.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 100, padding: 3, marginBottom: 12, alignSelf: "flex-start" }}>
        {KIND_TABS.map((tab) => {
          const active = kind === tab.key;
          return (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              style={{
                display: "flex", alignItems: "center", height: 30, padding: "0 14px", borderRadius: 100,
                fontSize: 12, fontWeight: active ? 700 : 600,
                color: active ? "var(--ink)" : "var(--body)",
                background: active ? "var(--white)" : "transparent",
                boxShadow: active ? "var(--shadow-card)" : "none",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <DataTable columns={COLUMNS} label="AI 对话记录列表">
          <DataTable.Head />
          {rows.map((row) => {
            const firstQuestion = row.messages[0]?.content ?? "";
            const isScripture = Boolean(row.book);
            return (
              <DataTable.Row key={row.id}>
                <DataTable.Cell>
                  <div className="user-cell">
                    <UserAvatar name={row.user.name} avatarColor={row.user.avatarColor} avatarUrl={row.user.avatarUrl} />
                    <div className="user-cell-text">
                      <div className="user-cell-name" title={row.user.name}>{row.user.name}</div>
                      <div className="user-cell-sub">UID {row.user.uid}</div>
                    </div>
                  </div>
                </DataTable.Cell>
                <DataTable.Cell truncate title={firstQuestion || row.title}>
                  <Link href={`/admin/ai-records/${row.id}`} style={{ display: "block", minWidth: 0 }}>
                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</strong>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--muted)" }}>
                      {isScripture && row.verseRefLabel ? `${row.verseRefLabel} · ` : ""}
                      {firstQuestion || "（还没有提问）"}
                    </span>
                  </Link>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Badge tone={isScripture ? "info" : "neutral"}>{isScripture ? "经文解读" : "自由提问"}</Badge>
                </DataTable.Cell>
                <DataTable.Cell align="right"><strong>{row._count.messages}</strong></DataTable.Cell>
                <DataTable.Cell>{formatDateTime(row.createdAt)}</DataTable.Cell>
                <DataTable.Cell>
                  <div className="row-actions">
                    <Link className="action-body" href={`/admin/ai-records/${row.id}`}>查看</Link>
                    <form action={deleteConversation}>
                      <input type="hidden" name="conversationId" value={row.id} />
                      <ConfirmSubmitButton className="action-pink" confirmMessage={`删除「${row.title}」这段对话？用户各设备上的这条记录也会在下次同步时消失，无法恢复。`}>
                        删除
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
          {rows.length === 0 && (
            <EmptyState
              title="没有找到对话记录"
              hint={keyword || kind !== "all" ? "换个关键词或类型筛选试试" : "用户登录后与慧读的问答会同步到这里"}
            />
          )}
        </DataTable>

        <Pagination info={info} basePath="/admin/ai-records" params={{ q: keyword, kind: kind === "all" ? undefined : kind }} />
      </div>
    </>
  );
}
