"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, Card, PageHeader, Section, Stat } from "@/components/ui/Primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { SearchShortcut, ShortcutHint } from "@/components/ui/SearchShortcut";

/**
 * 组件预览页（不需要登录，仅本地开发可见）。
 *
 * 后台其余页面都要登录才能看，改样式时无法快速自查；这里把每个组件的
 * 各种状态一次性摆出来，用于核对密度、对比度、长文本溢出与焦点样式。
 */
const COLUMNS: Column[] = [
  { key: "name", label: "名称", width: "1.6fr" },
  { key: "owner", label: "负责人", width: "120px" },
  { key: "count", label: "数量", width: "90px", align: "right" },
  { key: "status", label: "状态", width: "90px" },
];

const LONG =
  "这是一段刻意写得很长很长的内容，用来验证长文本在固定宽度的表格列里会不会撑破布局——正确的表现是单行省略号，并且悬停能看到完整内容。";

export default function ComponentPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    return <div style={{ padding: 40 }}>该预览页仅在开发环境可用。</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <SearchShortcut />
      <PageHeader
        title="组件预览"
        meta="后台 UI 组件的全状态自查页 · 仅开发环境可见 · 按 / 聚焦搜索"
        actions={
          <form className="search-box" onSubmit={(e) => e.preventDefault()}>
            <input name="q" placeholder="按 / 聚焦此处" />
            <ShortcutHint />
          </form>
        }
      />

      <Section title="关键指标" hint="等宽数字，多个指标纵向对齐便于比较">
        <div className="stat-grid">
          <Card><Stat label="待处理举报" value={12} tone="err" hint="SLA ≤ 24h" /></Card>
          <Card><Stat label="今日新增用户" value={148} tone="ok" /></Card>
          <Card><Stat label="AI 消耗" value="1,284,930" hint="token / 今日" /></Card>
          <Card><Stat label="待审词条" value={3} tone="warn" /></Card>
        </div>
      </Section>

      <Section title="状态标签" hint="按语义命名，高饱和色只在这里出现">
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge>中性 / 默认</Badge>
            <Badge tone="ok">成功 · 正常</Badge>
            <Badge tone="warn">告警 · 待审</Badge>
            <Badge tone="err">错误 · 已封禁</Badge>
            <Badge tone="info">信息 · 中阶</Badge>
          </div>
        </Card>
      </Section>

      <Section title="数据表 · 正常态" hint="列宽由 Context 下发；第一行演示长文本省略，后两行演示行级状态条">
        <Card padded={false}>
          <DataTable columns={COLUMNS} label="预览表格">
            <DataTable.Head />
            <DataTable.Row>
              <DataTable.Cell truncate title={LONG}>{LONG}</DataTable.Cell>
              <DataTable.Cell truncate>王弟兄</DataTable.Cell>
              <DataTable.Cell align="right">1,248</DataTable.Cell>
              <DataTable.Cell><Badge tone="ok">正常</Badge></DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row tone="warn">
              <DataTable.Cell>需要关注的行（左侧告警色条）</DataTable.Cell>
              <DataTable.Cell>李姊妹</DataTable.Cell>
              <DataTable.Cell align="right">86</DataTable.Cell>
              <DataTable.Cell><Badge tone="warn">待审</Badge></DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row tone="err">
              <DataTable.Cell>出问题的行（左侧错误色条）</DataTable.Cell>
              <DataTable.Cell>—</DataTable.Cell>
              <DataTable.Cell align="right">0</DataTable.Cell>
              <DataTable.Cell><Badge tone="err">已封禁</Badge></DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        </Card>
      </Section>

      <Section title="数据表 · 加载态" hint="骨架屏保持版面高度稳定，不产生跳动">
        <Card padded={false}><TableSkeleton rows={4} columns={4} /></Card>
      </Section>

      <Section title="空状态" hint="标题说清空的是什么，引导说清怎样才会有">
        <Card padded={false}>
          <EmptyState
            title="暂无待处理举报"
            hint="用户在 App 或网页端提交举报后会出现在这里，处理时限 24 小时内。"
            action={<button className="action-purple">查看历史处理记录</button>}
          />
        </Card>
      </Section>

      <Section title="错误态" hint="说清哪里出错并给重试路径">
        <Card padded={false}>
          <ErrorState
            title="数据加载失败"
            hint="无法连接到数据库，请检查服务状态后重试。若持续失败，请查看服务端日志。"
            action={<button className="action-purple">重新加载</button>}
          />
        </Card>
      </Section>
    </div>
  );
}
