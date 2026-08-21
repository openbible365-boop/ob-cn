import type { CSSProperties, ReactNode } from "react";
import { templateOf } from "./gridTemplate";

/**
 * 后台列表的组合组件。
 *
 * 解决的问题：原先每张表都在表头和「每一行」重复内联同一份
 * gridTemplateColumns，全站 31 处硬编码——改一列宽要同时改两处，
 * 漏改就错位。现在列定义只写一次。
 *
 * 实现说明：这里**刻意不用 React Context** 下发列宽。后台页面全是
 * Server Component，而 Context 在 Server Component 中不受支持
 * （见 next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md）。
 * 改为由根组件算出 grid 轨道、通过 CSS 变量 --dt-cols 传给后代：
 * CSS 变量天然继承，既跨得过 Server/Client 边界，也不必把整棵表变成客户端组件。
 *
 * 用法：
 *   <DataTable columns={COLS} label="用户列表">
 *     {rows.map(r => (
 *       <DataTable.Row key={r.id}>
 *         <DataTable.Cell truncate>{r.name}</DataTable.Cell>
 *       </DataTable.Row>
 *     ))}
 *   </DataTable>
 */

export type Column = {
  key: string;
  label: ReactNode;
  /** CSS grid 轨道值，如 "1.4fr" / "120px" */
  width: string;
  /** 数字列右对齐更易比较大小 */
  align?: "left" | "right" | "center";
};

function DataTableRoot({
  columns,
  children,
  /** 表格整体的无障碍标签，读屏用 */
  label,
}: {
  columns: Column[];
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      className="dt"
      role="table"
      aria-label={label}
      // 列宽只在这里算一次，后代靠继承拿到
      style={{ "--dt-cols": templateOf(columns) } as CSSProperties}
    >
      <div className="dt-head" role="row">
        {columns.map((c) => (
          <div key={c.key} role="columnheader" className={c.align ? `is-${c.align}` : undefined}>
            {c.label}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

/** 表头已由根组件按列定义自动渲染；保留此空组件是为了兼容显式写法，不重复输出 */
function DataTableHead() {
  return null;
}

function DataTableRow({
  children,
  /** 行级状态：左侧一道细色条，不给整行上高饱和底色 */
  tone,
}: {
  children: ReactNode;
  tone?: "warn" | "err";
}) {
  return (
    <div role="row" className={`dt-row${tone ? ` is-${tone}` : ""}`}>
      {children}
    </div>
  );
}

function DataTableCell({
  children,
  align,
  /** 长文本单行省略；配合 title 悬停看全文 */
  truncate,
  title,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  truncate?: boolean;
  title?: string;
}) {
  return (
    <div
      role="cell"
      className={`dt-cell${align ? ` is-${align}` : ""}${truncate ? " is-truncate" : ""}`}
      title={title}
    >
      {children}
    </div>
  );
}

export const DataTable = Object.assign(DataTableRoot, {
  Head: DataTableHead,
  Row: DataTableRow,
  Cell: DataTableCell,
});
