import { db } from "@/lib/db";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination, SearchBox } from "@/components/Pagination";
import {
  deleteEncyclopediaEntry,
  saveEncyclopediaEntry,
} from "@/lib/actions/library";

const TYPE_LABEL = {
  DICTIONARY: "词典",
  ARTICLE: "文章",
  DEVOTIONAL: "灵修",
} as const;

type EntryType = keyof typeof TYPE_LABEL;

export default async function EncyclopediaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; edit?: string; q?: string; page?: string }>;
}) {
  const { type, edit, q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const activeType = type && type in TYPE_LABEL ? (type as EntryType) : undefined;

  const entryWhere = {
    ...(activeType ? { entryType: activeType } : {}),
    ...(q
      ? {
          OR: [
            { titleZh: { contains: q, mode: "insensitive" as const } },
            { titleEn: { contains: q, mode: "insensitive" as const } },
            { summaryZh: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [entries, counts, entryTotal] = await Promise.all([
    db.encyclopediaEntry.findMany({
      where: entryWhere,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      ...pageQuery(page),
    }),
    db.encyclopediaEntry.groupBy({ by: ["entryType"], _count: true }),
    db.encyclopediaEntry.count({ where: entryWhere }),
  ]);
  const info = pageInfo(page, entryTotal);

  const editing = edit ? entries.find((entry) => entry.id === edit) ?? null : null;
  const countOf = (key: EntryType) =>
    counts.find((row) => row.entryType === key)?._count ?? 0;

  return (
    <>
      <div className="admin-header">
        <div>
          <div className="title">圣经百科</div>
          <div className="meta" style={{ marginTop: 3 }}>
            词典、文章与灵修短文，网页版与 App 共用同一份内容
          </div>
        </div>
        <div className="meta">共 {counts.reduce((sum, row) => sum + row._count, 0)} 条</div>
      </div>

      <nav className="library-filters" aria-label="按类型筛选">
        <a className={!activeType ? "is-active" : ""} href="/admin/encyclopedia">
          全部
        </a>
        {(Object.keys(TYPE_LABEL) as EntryType[]).map((key) => (
          <a
            key={key}
            className={activeType === key ? "is-active" : ""}
            href={`/admin/encyclopedia?type=${key}`}
          >
            {TYPE_LABEL[key]} {countOf(key)}
          </a>
        ))}
      </nav>

      <section className="card library-form">
        <h2>{editing ? "编辑条目" : "新增条目"}</h2>
        <form action={saveEncyclopediaEntry}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="library-form-grid">
            <label>
              类型
              <select name="entryType" defaultValue={editing?.entryType ?? activeType ?? "DICTIONARY"}>
                {(Object.keys(TYPE_LABEL) as EntryType[]).map((key) => (
                  <option key={key} value={key}>{TYPE_LABEL[key]}</option>
                ))}
              </select>
            </label>
            <label>
              分类
              <input name="category" defaultValue={editing?.category ?? ""} placeholder="如：神学词汇" />
            </label>
            <label>
              首字母索引
              <input name="indexLetter" defaultValue={editing?.indexLetter ?? ""} placeholder="词典用，A-Z 或 #" />
            </label>
            <label>
              作者
              <input name="author" defaultValue={editing?.author ?? ""} />
            </label>
            <label>
              封面样式
              <input name="coverStyle" defaultValue={editing?.coverStyle ?? ""} placeholder="渐变或图标名" />
            </label>
            <label>
              排序
              <input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} />
            </label>
          </div>

          <div className="library-form-grid">
            <label>
              标题（中）
              <input name="titleZh" required defaultValue={editing?.titleZh ?? ""} />
            </label>
            <label>
              标题（英）
              <input name="titleEn" defaultValue={editing?.titleEn ?? ""} />
            </label>
            <label>
              标题（韩）
              <input name="titleKo" defaultValue={editing?.titleKo ?? ""} />
            </label>
          </div>

          <label className="library-form-full">
            摘要（中）
            <textarea name="summaryZh" rows={2} defaultValue={editing?.summaryZh ?? ""} />
          </label>
          <div className="library-form-grid">
            <label>
              摘要（英）
              <textarea name="summaryEn" rows={2} defaultValue={editing?.summaryEn ?? ""} />
            </label>
            <label>
              摘要（韩）
              <textarea name="summaryKo" rows={2} defaultValue={editing?.summaryKo ?? ""} />
            </label>
          </div>

          <label className="library-form-full">
            正文（中）
            <textarea name="contentZh" rows={6} defaultValue={editing?.contentZh ?? ""} />
          </label>
          <div className="library-form-grid">
            <label>
              正文（英）
              <textarea name="contentEn" rows={4} defaultValue={editing?.contentEn ?? ""} />
            </label>
            <label>
              正文（韩）
              <textarea name="contentKo" rows={4} defaultValue={editing?.contentKo ?? ""} />
            </label>
          </div>

          <div className="library-form-actions">
            <label className="library-form-check">
              <input type="checkbox" name="isActive" defaultChecked={editing ? editing.isActive : true} />
              前台可见
            </label>
            {editing && <a className="library-cancel" href="/admin/encyclopedia">取消编辑</a>}
            <button type="submit">{editing ? "保存修改" : "新增条目"}</button>
          </div>
        </form>
      </section>

      <section className="card library-list">
        <SearchBox
          basePath="/admin/encyclopedia"
          defaultValue={q}
          placeholder="搜索标题 / 摘要"
          hidden={{ type: activeType ?? undefined }}
        />
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>分类</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={5} className="meta">
                {q ? "没有找到匹配的条目，换个关键词试试。" : "还没有内容，用上方表单新增。"}
              </td></tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <strong>{entry.titleZh ?? "未命名"}</strong>
                  {entry.summaryZh && <div className="meta">{entry.summaryZh.slice(0, 40)}</div>}
                </td>
                <td>{TYPE_LABEL[entry.entryType as EntryType]}</td>
                <td>{entry.category ?? "—"}</td>
                <td>{entry.isActive ? "已上架" : "已下架"}</td>
                <td className="library-row-actions">
                  <a href={`/admin/encyclopedia?edit=${entry.id}${activeType ? `&type=${activeType}` : ""}`}>编辑</a>
                  <form action={deleteEncyclopediaEntry}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button type="submit" className="is-danger">删除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination info={info} basePath="/admin/encyclopedia" params={{ type: activeType ?? undefined, q }} />
      </section>
    </>
  );
}
