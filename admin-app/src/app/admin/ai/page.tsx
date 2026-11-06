import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, type Tone } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";
import { formatCents, formatDate, formatTokensPerDay } from "@/lib/format";
import { toggleAutoFallback, toggleRateLimit, expandCanary, rollbackToVersion } from "@/lib/actions/ai";
import { ApiKeyControl } from "@/components/ApiKeyControl";
import { EditPromptVersionControl } from "@/components/EditPromptVersionControl";
import { CreatePromptVersionControl } from "@/components/CreatePromptVersionControl";
import { CommunityTokenLimitControl } from "@/components/CommunityTokenLimitControl";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const STATUS_LABELS: Record<string, string> = {
  NORMAL: "正常",
  STANDBY: "待命",
  DEGRADED: "异常",
};

// 语义映射：灰度中需要盯着看=告警，全量=正常，已归档=中性
const PROMPT_STATUS_TONE: Record<string, Tone> = {
  CANARY: "warn",
  GA: "ok",
  ARCHIVED: "neutral",
};

const PROMPT_COLUMNS: Column[] = [
  { key: "version", label: "版本", width: "90px" },
  { key: "desc", label: "说明", width: "1fr" },
  { key: "status", label: "状态", width: "130px" },
  { key: "like", label: "点赞率", width: "100px", align: "right" },
  { key: "dislike", label: "点踩率", width: "100px", align: "right" },
  { key: "ops", label: "操作", width: "200px" },
];

function promptStatusLabel(status: string, rolloutPercent: number) {
  if (status === "GA") return `全量 ${rolloutPercent}%`;
  if (status === "CANARY") return `灰度 ${rolloutPercent}%`;
  return "已归档";
}

export default async function AiManagementPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  const [models, settings, versions, tokenTop] = await Promise.all([
    db.aiModel.findMany({ orderBy: { role: "asc" } }),
    db.aiSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    db.promptVersion.findMany({ orderBy: { createdAt: "desc" } }),
    db.community.findMany({
      where: { status: "ACTIVE" },
      orderBy: { aiTokensToday: "desc" },
      take: 2,
    }),
  ]);

  const primary = models.find((m) => m.role === "PRIMARY");
  const backup = models.find((m) => m.role === "BACKUP");
  const spendPct = Math.round((settings.monthSpendCents / settings.monthlyBudgetCents) * 100);

  return (
    <>
      <div className="admin-header">
        <div className="title">AI 模型与提示词</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>核心慧读配置</div>
            <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--purple)" }}>变更不停服生效</div>
          </div>

          {[primary, backup].filter(Boolean).length === 0 && (
            <EmptyState title="尚未配置模型" hint="在数据库 AiModel 表中配置主/备模型后显示" />
          )}
          {[primary, backup].filter(Boolean).map((m) => (
            <div key={m!.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", borderRadius: 12, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, background: m!.status === "NORMAL" ? "var(--purple)" : "var(--line)", borderRadius: 100 }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                {m!.role === "PRIMARY" ? "主模型" : "备用模型"} · {m!.modelName}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
                {m!.role === "PRIMARY" ? `温度 ${m!.temperature} · ` : ""}{STATUS_LABELS[m!.status]}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>主模型异常自动降级</div>
            <form action={toggleAutoFallback}>
              <button
                type="submit"
                style={{
                  display: "flex", justifyContent: settings.autoFallbackEnabled ? "flex-end" : "flex-start",
                  width: 40, height: 24, background: settings.autoFallbackEnabled ? "var(--purple)" : "var(--surface-2)",
                  borderRadius: 100, padding: 3, border: "none", cursor: "pointer",
                }}
              >
                <div style={{ width: 18, height: 18, background: "#fff", borderRadius: 100 }} />
              </button>
            </form>
            <div style={{ flex: 1 }} />
            {primary && (
              <ApiKeyControl
                modelId={primary.id}
                apiKeyLast4={primary.apiKeyLast4}
                apiKeyUpdatedAt={primary.apiKeyUpdatedAt ? formatDate(primary.apiKeyUpdatedAt) : null}
              />
            )}
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>成本告警</div>
            <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--body)" }}>邮件 / IM 触达值班</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            <span>{settings.monthLabel}预算 {formatCents(settings.monthlyBudgetCents)}</span>
            <span>已用 {formatCents(settings.monthSpendCents)} · {spendPct}%</span>
          </div>
          <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 100, marginBottom: 14 }}>
            <div style={{ width: `${Math.min(100, spendPct)}%`, height: "100%", background: "var(--orange)", borderRadius: 100 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>
              {settings.rateLimited ? "已开启全局限流" : "超限自动告警，可一键全局限流"}
            </div>
            <form action={toggleRateLimit} style={{ marginLeft: "auto" }}>
              <button
                type="submit"
                style={{
                  display: "flex", alignItems: "center", height: 32, padding: "0 14px", borderRadius: 100,
                  fontSize: 12, fontWeight: 700, color: settings.rateLimited ? "var(--ink)" : "#fff",
                  background: settings.rateLimited ? "var(--surface-2)" : "var(--pink)", border: "none", cursor: "pointer",
                }}
              >
                {settings.rateLimited ? "解除限流" : "一键限流"}
              </button>
            </form>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--surface-2)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>社群 AI 助理 Token 消耗 Top</div>
            {tokenTop.length === 0 && (
              <div style={{ padding: "12px 0", color: "var(--body)", fontSize: 12, fontWeight: 600 }}>
                今日暂无社群 AI 助理消耗
              </div>
            )}
            {tokenTop.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "5px 0" }}>
                <div style={{ flex: 1, fontWeight: 700 }}>{c.name}</div>
                <div style={{ color: "var(--body)", fontWeight: 600 }}>{formatTokensPerDay(c.aiTokensToday)}</div>
                <CommunityTokenLimitControl communityId={c.id} limit={c.aiTokenDailyLimit} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, borderRadius: "16px 16px 0 0", padding: "16px 18px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>系统 Prompt 版本管理</div>
          <CreatePromptVersionControl />
        </div>
        <DataTable columns={PROMPT_COLUMNS} label="提示词版本列表">
        {versions.length === 0 && (
          <EmptyState title="还没有提示词版本" hint="用上方表单新建第一个版本，灰度发布后可在此对比点赞率" />
        )}
        {versions.map((v) => (
          <DataTable.Row key={v.id}>
            <DataTable.Cell><strong>{v.version}</strong></DataTable.Cell>
            <DataTable.Cell truncate title={v.description}>{v.description}</DataTable.Cell>
            <DataTable.Cell>
              <Badge tone={PROMPT_STATUS_TONE[v.status]}>{promptStatusLabel(v.status, v.rolloutPercent)}</Badge>
            </DataTable.Cell>
            <DataTable.Cell align="right"><strong>{v.likeRatePct != null ? `${v.likeRatePct}%` : "—"}</strong></DataTable.Cell>
            <DataTable.Cell align="right"><strong>{v.dislikeRatePct != null ? `${v.dislikeRatePct}%` : "—"}</strong></DataTable.Cell>
            <DataTable.Cell>
            <div className="row-actions">
              {v.status === "CANARY" && (
                <form action={expandCanary}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className="action-purple">扩大灰度</button>
                </form>
              )}
              {v.status !== "ARCHIVED" && (
                <EditPromptVersionControl id={v.id} description={v.description} rolloutPercent={v.rolloutPercent} />
              )}
              {v.status === "ARCHIVED" && (
                <form action={rollbackToVersion}>
                  <input type="hidden" name="id" value={v.id} />
                  <ConfirmSubmitButton
                    className="action-purple"
                    confirmMessage={`确定要回滚到 ${v.version} 吗？当前全量版本将被归档。`}
                  >
                    回滚至此版
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
        </DataTable>
      </div>
    </>
  );
}
