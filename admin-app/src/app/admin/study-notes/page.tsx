import { db } from "@/lib/db";
import { deleteStudyNote, saveStudyNote } from "@/lib/actions/library";

export default async function StudyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string }>;
}) {
  const { q, edit } = await searchParams;
  const keyword = q?.trim() ?? "";

  const where = keyword
    ? {
        OR: [
          { verseRef: { contains: keyword, mode: "insensitive" as const } },
          { content: { contains: keyword, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [notes, total] = await Promise.all([
    db.studyNote.findMany({ where, orderBy: { verseRef: "asc" }, take: 200 }),
    db.studyNote.count(),
  ]);

  const editing = edit ? notes.find((note) => note.id === edit) ?? null : null;

  return (
    <>
      <div className="admin-header">
        <div>
          <div className="title">研经笔记</div>
          <div className="meta" style={{ marginTop: 3 }}>
            按经节存放的注释语料，供慧读检索使用
          </div>
        </div>
        <div className="meta">共 {total} 条</div>
      </div>

      <section className="card library-form">
        <form className="library-search" action="/admin/study-notes">
          <input name="q" defaultValue={keyword} placeholder="搜索经节引用或注释内容" aria-label="搜索研经笔记" />
          <button type="submit">搜索</button>
          {keyword && <a className="library-cancel" href="/admin/study-notes">清空</a>}
        </form>
      </section>

      <section className="card library-form">
        <h2>{editing ? "编辑笔记" : "新增笔记"}</h2>
        <form action={saveStudyNote}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <label className="library-form-full">
            经节引用
            <input
              name="verseRef"
              required
              defaultValue={editing?.verseRef ?? ""}
              placeholder="书卷-章-节，例如 gen-1-1"
            />
          </label>
          <label className="library-form-full">
            注释内容
            <textarea name="content" rows={6} required defaultValue={editing?.content ?? ""} />
          </label>
          <div className="library-form-actions">
            {editing && <a className="library-cancel" href="/admin/study-notes">取消编辑</a>}
            <button type="submit">{editing ? "保存修改" : "保存笔记"}</button>
          </div>
        </form>
        {!editing && (
          <div className="meta">同一节经文只保留一条，重复保存会覆盖原有内容。</div>
        )}
      </section>

      <section className="card library-list">
        <table className="admin-table">
          <thead>
            <tr>
              <th>经节</th>
              <th>内容</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 && (
              <tr>
                <td colSpan={3} className="meta">
                  {keyword ? `没有匹配「${keyword}」的笔记。` : "还没有研经笔记，用上方表单新增。"}
                </td>
              </tr>
            )}
            {notes.map((note) => (
              <tr key={note.id}>
                <td><strong>{note.verseRef}</strong></td>
                <td>{note.content.slice(0, 60)}{note.content.length > 60 ? "…" : ""}</td>
                <td className="library-row-actions">
                  <a href={`/admin/study-notes?edit=${note.id}${keyword ? `&q=${encodeURIComponent(keyword)}` : ""}`}>编辑</a>
                  <form action={deleteStudyNote}>
                    <input type="hidden" name="id" value={note.id} />
                    <button type="submit" className="is-danger">删除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
