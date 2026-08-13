import { db } from "@/lib/db";
import {
  deleteSpiritualQuestion,
  deleteSpiritualStage,
  saveSpiritualQuestion,
  saveSpiritualStage,
} from "@/lib/actions/library";

const CATEGORY_LABEL: Record<string, string> = {
  general: "通用问题",
  verse_drawer: "经文抽屉",
};

export default async function SpiritualPage({
  searchParams,
}: {
  searchParams: Promise<{ editStage?: string; editQuestion?: string }>;
}) {
  const { editStage, editQuestion } = await searchParams;

  // 灵修阶段是配置型数据（阶段数固定、题目有限），不做分页，
  // 但仍设保护上限，避免误操作产生海量数据时把页面拖垮。
  const stages = await db.spiritualStage.findMany({
    orderBy: { sortOrder: "asc" },
    include: { questions: { orderBy: { sortOrder: "asc" }, take: 200 } },
    take: 50,
  });

  const stageBeingEdited = editStage
    ? stages.find((stage) => stage.id === editStage) ?? null
    : null;
  const questionBeingEdited = editQuestion
    ? stages.flatMap((stage) => stage.questions).find((q) => q.id === editQuestion) ?? null
    : null;
  const questionCount = stages.reduce((sum, stage) => sum + stage.questions.length, 0);

  return (
    <>
      <div className="admin-header">
        <div>
          <div className="title">灵修引导</div>
          <div className="meta" style={{ marginTop: 3 }}>
            属灵阶段与对应的引导问题，前台按用户所处阶段推送
          </div>
        </div>
        <div className="meta">{stages.length} 个阶段 · {questionCount} 个问题</div>
      </div>

      <section className="card library-form">
        <h2>{stageBeingEdited ? "编辑阶段" : "新增阶段"}</h2>
        <form action={saveSpiritualStage}>
          {stageBeingEdited && <input type="hidden" name="id" value={stageBeingEdited.id} />}
          <div className="library-form-grid">
            <label>
              阶段名称
              <input name="name" required defaultValue={stageBeingEdited?.name ?? ""} placeholder="如：慕道 / 初信 / 成长 / 成熟" />
            </label>
            <label>
              排序
              <input name="sortOrder" type="number" defaultValue={stageBeingEdited?.sortOrder ?? 0} />
            </label>
          </div>
          <label className="library-form-full">
            阶段说明
            <textarea name="description" rows={2} defaultValue={stageBeingEdited?.description ?? ""} />
          </label>
          <div className="library-form-actions">
            {stageBeingEdited && <a className="library-cancel" href="/admin/spiritual">取消编辑</a>}
            <button type="submit">{stageBeingEdited ? "保存修改" : "新增阶段"}</button>
          </div>
        </form>
      </section>

      {stages.length > 0 && (
        <section className="card library-form">
          <h2>{questionBeingEdited ? "编辑问题" : "新增问题"}</h2>
          <form action={saveSpiritualQuestion}>
            {questionBeingEdited && <input type="hidden" name="id" value={questionBeingEdited.id} />}
            <div className="library-form-grid">
              <label>
                所属阶段
                <select name="stageId" defaultValue={questionBeingEdited?.stageId ?? stages[0].id}>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </label>
              <label>
                问题分类
                <select name="category" defaultValue={questionBeingEdited?.category ?? "general"}>
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                排序
                <input name="sortOrder" type="number" defaultValue={questionBeingEdited?.sortOrder ?? 0} />
              </label>
            </div>
            <label className="library-form-full">
              问题内容
              <textarea name="questionText" rows={2} required defaultValue={questionBeingEdited?.questionText ?? ""} />
            </label>
            <label className="library-form-full">
              补充说明
              <textarea name="description" rows={2} defaultValue={questionBeingEdited?.description ?? ""} />
            </label>
            <div className="library-form-actions">
              <label className="library-form-check">
                <input type="checkbox" name="isActive" defaultChecked={questionBeingEdited ? questionBeingEdited.isActive : true} />
                前台可见
              </label>
              {questionBeingEdited && <a className="library-cancel" href="/admin/spiritual">取消编辑</a>}
              <button type="submit">{questionBeingEdited ? "保存修改" : "新增问题"}</button>
            </div>
          </form>
        </section>
      )}

      {stages.length === 0 && (
        <section className="card"><div className="meta">还没有属灵阶段，先用上方表单新增一个。</div></section>
      )}

      {stages.map((stage) => (
        <section className="card library-list" key={stage.id}>
          <div className="library-stage-heading">
            <div>
              <strong>{stage.name}</strong>
              {stage.description && <div className="meta">{stage.description}</div>}
            </div>
            <div className="library-row-actions">
              <a href={`/admin/spiritual?editStage=${stage.id}`}>编辑</a>
              <form action={deleteSpiritualStage}>
                <input type="hidden" name="id" value={stage.id} />
                <button type="submit" className="is-danger">删除阶段</button>
              </form>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>问题</th>
                <th>分类</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {stage.questions.length === 0 && (
                <tr><td colSpan={4} className="meta">这个阶段还没有问题。</td></tr>
              )}
              {stage.questions.map((question) => (
                <tr key={question.id}>
                  <td>{question.questionText}</td>
                  <td>{CATEGORY_LABEL[question.category] ?? question.category}</td>
                  <td>{question.isActive ? "已启用" : "已停用"}</td>
                  <td className="library-row-actions">
                    <a href={`/admin/spiritual?editQuestion=${question.id}`}>编辑</a>
                    <form action={deleteSpiritualQuestion}>
                      <input type="hidden" name="id" value={question.id} />
                      <button type="submit" className="is-danger">删除</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
