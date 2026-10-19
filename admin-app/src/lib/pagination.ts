// 后台列表分页的统一约定。
//
// 运营常需要知道「第几页、共多少条」来定位数据，所以用页码式而不是游标式。
// 每个列表页都必须走这里，避免出现无上限的 findMany —— 数据一多会把整表拉进内存。

export const PAGE_SIZE = 30;

/** 从 searchParams 解析页码（1 起），非法值一律回到第 1 页。 */
export function parsePage(value: string | undefined) {
  const n = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 传给 Prisma 的 skip / take。 */
export function pageQuery(page: number, size = PAGE_SIZE) {
  return { skip: (page - 1) * size, take: size };
}

export type PageInfo = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export function pageInfo(page: number, total: number, size = PAGE_SIZE): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, totalPages);
  return {
    page: current,
    size,
    total,
    totalPages,
    from: total === 0 ? 0 : (current - 1) * size + 1,
    to: Math.min(current * size, total),
    hasPrev: current > 1,
    hasNext: current < totalPages,
  };
}

/** 保留现有查询参数，只覆盖页码，供分页链接使用。 */
export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && k !== "page") sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
