import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Badge, Card, Grid, PageHeader, Stat } from "@/components/ui/Primitives";
import { checkAiServices } from "@/lib/ai-status";
import { formatDateTime } from "@/lib/format";

// AI 服务：显示慧读实际使用的模型与检索服务、实时连通性和真实用量。
// 以前这页的「模型切换 / 成本预算 / Prompt 灰度」读写的是一组演示表，慧读并不使用，
// 操作了也不会生效，容易误导运营，所以改成只展示真实状态。

const DAY = 24 * 60 * 60 * 1000;

const STATUS_BADGE = {
  ok: { tone: "ok", label: "正常" },
  down: { tone: "err", label: "异常" },
  unconfigured: { tone: "warn", label: "未配置" },
} as const;

export default async function AiServicePage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const [checks, conversationsDay, conversationsWeek, usersWeek, questionsTotal, latest] = await Promise.all([
    checkAiServices(),
    db.conversation.count({ where: { createdAt: { gte: dayAgo } } }),
    db.conversation.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { conversations: { some: { createdAt: { gte: weekAgo } } } } }),
    db.message.count({ where: { role: "USER" } }),
    db.conversation.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const allOk = checks.every((check) => check.status === "ok");

  return (
    <>
      <PageHeader
        title="AI 服务"
        meta={`慧读的模型与检索服务 · 检测于 ${formatDateTime(now)}`}
        actions={
          <Link href="/admin/ai" className="action-body" style={{ fontSize: 12, fontWeight: 700 }}>
            重新检测
          </Link>
        }
      />

      <div
        className="card"
        style={{
          borderRadius: 16, padding: "12px 16px", marginBottom: 12, fontSize: 13, fontWeight: 600,
          background: allOk ? "var(--white)" : "var(--yellow-soft)",
          color: allOk ? "var(--ink)" : "var(--yellow-ink)",
        }}
      >
        {allOk ? "✓ 慧读服务运行正常" : "⚠ 有服务未就绪，见下方说明。用户此时提问可能失败或回答不引用注释。"}
      </div>

      <Grid min="300px">
        {checks.map((check) => {
          const badge = STATUS_BADGE[check.status];
          return (
            <Card key={check.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 15, color: "var(--ink)" }}>{check.name}</strong>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                {check.latencyMs !== null && (
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{check.latencyMs} ms</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>{check.purpose}</div>
              <dl style={{ margin: 0, display: "grid", gap: 6, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <dt style={{ color: "var(--muted)" }}>配置</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{check.detail}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <dt style={{ color: "var(--muted)" }}>服务地址</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{check.host ?? "—"}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <dt style={{ color: "var(--muted)" }}>状态</dt>
                  <dd style={{ margin: 0, fontWeight: 600, color: check.status === "ok" ? "var(--ink)" : "var(--pink)" }}>{check.message}</dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </Grid>

      <Grid min="160px">
        <Card><Stat label="近 24 小时新对话" value={conversationsDay.toLocaleString()} /></Card>
        <Card><Stat label="近 7 天新对话" value={conversationsWeek.toLocaleString()} hint={`${usersWeek} 人使用`} /></Card>
        <Card><Stat label="累计提问" value={questionsTotal.toLocaleString()} /></Card>
        <Card>
          <Stat label="最近一次对话" value={latest ? formatDateTime(latest.createdAt).slice(5) : "—"} />
        </Card>
      </Grid>

      <div className="card" style={{ borderRadius: 16, padding: "14px 16px", fontSize: 12, lineHeight: 1.9, color: "var(--body)" }}>
        <strong style={{ color: "var(--ink)" }}>怎么调整：</strong>
        模型与服务地址在服务器环境变量里配置（<code>OPENBIBLE_LLM_MODEL</code>、<code>OPENBIBLE_LLM_BASE_URL</code>、
        <code>OPENBIBLE_LLM_API_KEY</code>、<code>OPENBIBLE_RAG_BASE_URL</code>、<code>OPENBIBLE_RAG_INTERNAL_API_KEY</code>），
        修改后重启后台服务生效。想看用户实际问了什么、回答得怎样，去
        <Link href="/admin/ai-records" style={{ color: "var(--purple)", fontWeight: 700 }}> AI 对话记录 </Link>抽查。
      </div>
    </>
  );
}
