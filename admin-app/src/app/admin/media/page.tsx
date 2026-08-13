import { db } from "@/lib/db";
import { pageInfo, pageQuery, parsePage } from "@/lib/pagination";
import { Pagination, SearchBox } from "@/components/Pagination";
import { deleteMediaItem, saveMediaItem } from "@/lib/actions/library";

const TYPE_LABEL = { VIDEO: "视频", AUDIO: "音频" } as const;
type MediaType = keyof typeof TYPE_LABEL;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; edit?: string; q?: string; page?: string }>;
}) {
  const { type, edit, q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const activeType = type && type in TYPE_LABEL ? (type as MediaType) : undefined;

  const itemWhere = {
    ...(activeType ? { mediaType: activeType } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { teacher: { contains: q, mode: "insensitive" as const } },
            { series: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, counts, itemTotal] = await Promise.all([
    db.mediaItem.findMany({
      where: itemWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      ...pageQuery(page),
    }),
    db.mediaItem.groupBy({ by: ["mediaType"], _count: true }),
    db.mediaItem.count({ where: itemWhere }),
  ]);
  const info = pageInfo(page, itemTotal);

  const editing = edit ? items.find((item) => item.id === edit) ?? null : null;
  const countOf = (key: MediaType) =>
    counts.find((row) => row.mediaType === key)?._count ?? 0;

  return (
    <>
      <div className="admin-header">
        <div>
          <div className="title">影音库</div>
          <div className="meta" style={{ marginTop: 3 }}>
            讲道视频与音频节目；文件放外部链接，不占用本站存储
          </div>
        </div>
        <div className="meta">共 {counts.reduce((sum, row) => sum + row._count, 0)} 条</div>
      </div>

      <nav className="library-filters" aria-label="按类型筛选">
        <a className={!activeType ? "is-active" : ""} href="/admin/media">全部</a>
        {(Object.keys(TYPE_LABEL) as MediaType[]).map((key) => (
          <a key={key} className={activeType === key ? "is-active" : ""} href={`/admin/media?type=${key}`}>
            {TYPE_LABEL[key]} {countOf(key)}
          </a>
        ))}
      </nav>

      <section className="card library-form">
        <h2>{editing ? "编辑影音" : "新增影音"}</h2>
        <form action={saveMediaItem}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="library-form-grid">
            <label>
              类型
              <select name="mediaType" defaultValue={editing?.mediaType ?? activeType ?? "VIDEO"}>
                {(Object.keys(TYPE_LABEL) as MediaType[]).map((key) => (
                  <option key={key} value={key}>{TYPE_LABEL[key]}</option>
                ))}
              </select>
            </label>
            <label>
              标题
              <input name="title" required defaultValue={editing?.title ?? ""} />
            </label>
            <label>
              系列
              <input name="series" defaultValue={editing?.series ?? ""} />
            </label>
            <label>
              分类
              <input name="category" defaultValue={editing?.category ?? ""} placeholder="如：旧约 / 新约 / 专题" />
            </label>
            <label>
              讲员
              <input name="teacher" defaultValue={editing?.teacher ?? ""} />
            </label>
            <label>
              时长
              <input name="duration" defaultValue={editing?.duration ?? ""} placeholder="如 45:32" />
            </label>
            <label>
              封面样式
              <input name="coverStyle" defaultValue={editing?.coverStyle ?? ""} />
            </label>
            <label>
              排序
              <input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} />
            </label>
          </div>
          <label className="library-form-full">
            播放链接
            <input name="url" type="url" defaultValue={editing?.url ?? ""} placeholder="https://" />
          </label>
          <label className="library-form-full">
            简介
            <textarea name="description" rows={3} defaultValue={editing?.description ?? ""} />
          </label>
          <div className="library-form-actions">
            <label className="library-form-check">
              <input type="checkbox" name="isActive" defaultChecked={editing ? editing.isActive : true} />
              前台可见
            </label>
            {editing && <a className="library-cancel" href="/admin/media">取消编辑</a>}
            <button type="submit">{editing ? "保存修改" : "新增影音"}</button>
          </div>
        </form>
      </section>

      <section className="card library-list">
        <SearchBox
          basePath="/admin/media"
          defaultValue={q}
          placeholder="搜索标题 / 讲员 / 系列"
          hidden={{ type: activeType ?? undefined }}
        />
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>讲员</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="meta">
                {q ? "没有找到匹配的影音，换个关键词试试。" : "还没有影音内容，用上方表单新增。"}
              </td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  {item.series && <div className="meta">{item.series}</div>}
                </td>
                <td>{TYPE_LABEL[item.mediaType as MediaType]}</td>
                <td>{item.teacher ?? "—"}</td>
                <td>{item.isActive ? "已上架" : "已下架"}</td>
                <td className="library-row-actions">
                  <a href={`/admin/media?edit=${item.id}${activeType ? `&type=${activeType}` : ""}`}>编辑</a>
                  <form action={deleteMediaItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="is-danger">删除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination info={info} basePath="/admin/media" params={{ type: activeType ?? undefined, q }} />
      </section>
    </>
  );
}
