import Link from "next/link";
import { pageHref, type PageInfo } from "@/lib/pagination";

/** 列表页统一的分页条：显示区间与总数，两侧翻页。 */
export function Pagination({
  info,
  basePath,
  params,
}: {
  info: PageInfo;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (info.total === 0) return null;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-count">
        第 {info.from}–{info.to} 条 · 共 {info.total} 条
      </span>
      <span className="admin-pagination-nav">
        {info.hasPrev ? (
          <Link href={pageHref(basePath, params, info.page - 1)} className="admin-pagination-btn">
            上一页
          </Link>
        ) : (
          <span className="admin-pagination-btn is-disabled">上一页</span>
        )}
        <span className="admin-pagination-page">
          {info.page} / {info.totalPages}
        </span>
        {info.hasNext ? (
          <Link href={pageHref(basePath, params, info.page + 1)} className="admin-pagination-btn">
            下一页
          </Link>
        ) : (
          <span className="admin-pagination-btn is-disabled">下一页</span>
        )}
      </span>
    </div>
  );
}

/** 列表为空时的统一提示。 */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="admin-empty">
      <div className="admin-empty-title">{title}</div>
      {hint && <div className="admin-empty-hint">{hint}</div>}
    </div>
  );
}

/** 列表页统一的搜索框（GET 表单，走 URL 参数，可分享可回退）。 */
export function SearchBox({
  basePath,
  defaultValue,
  placeholder,
  hidden,
}: {
  basePath: string;
  defaultValue?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={basePath} method="get" className="admin-searchbox">
      {Object.entries(hidden ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="submit">搜索</button>
      {defaultValue ? (
        <Link href={basePath} className="admin-searchbox-clear">
          清除
        </Link>
      ) : null}
    </form>
  );
}
