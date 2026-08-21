import type { Column } from "./DataTable";

/**
 * 列定义 → CSS grid 轨道。
 *
 * 弹性列一律包 minmax(0, …)：grid 轨道的默认 min-width 是 auto，
 * 不设 0 的话，超长内容（长邮箱、长标题）会把轨道撑破，
 * 子元素的 text-overflow: ellipsis 也就永远不触发。
 */
export function templateOf(columns: Pick<Column, "width">[]) {
  return columns
    .map((c) => (c.width.endsWith("fr") ? `minmax(0, ${c.width})` : c.width))
    .join(" ");
}
