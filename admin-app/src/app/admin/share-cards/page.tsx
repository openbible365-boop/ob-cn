import {
  selectShareCardTemplate,
  toggleShareCardRotation,
  updateShareCardRotationDays,
} from "@/lib/actions/share-cards";
import {
  resolveShareCardTemplate,
  SHARE_CARD_TEMPLATES,
} from "@/lib/share-card-templates";
import { getShareCardSettings } from "@/lib/share-card-settings-store";

export default async function ShareCardsPage() {
  const settings = await getShareCardSettings();
  const effectiveTemplate = resolveShareCardTemplate(settings);

  return (
    <>
      <div className="admin-header">
        <div>
          <div className="title">分享模板</div>
          <div className="meta" style={{ marginTop: 3 }}>
            控制每日金句和经文分享图片的默认视觉风格
          </div>
        </div>
        <span className="share-card-admin-status">
          当前生效：{SHARE_CARD_TEMPLATES.find((item) => item.id === effectiveTemplate)?.name}
        </span>
      </div>

      <section className="card share-card-admin-settings">
        <div>
          <strong>自动轮换</strong>
          <span>开启后，从当前模板开始，按设定周期依次轮换四种风格。</span>
        </div>
        <form action={toggleShareCardRotation}>
          <button
            type="submit"
            className={`share-card-admin-switch${settings.autoRotate ? " is-on" : ""}`}
            aria-label={`自动轮换，${settings.autoRotate ? "已开启" : "已关闭"}`}
          >
            <i />
          </button>
        </form>
        <form action={updateShareCardRotationDays} className="share-card-admin-period">
          <label htmlFor="rotationDays">轮换周期</label>
          <select id="rotationDays" name="rotationDays" defaultValue={String(settings.rotationDays)}>
            <option value="1">每天</option>
            <option value="3">每 3 天</option>
            <option value="7">每 7 天</option>
            <option value="14">每 14 天</option>
            <option value="30">每 30 天</option>
          </select>
          <button type="submit">保存周期</button>
        </form>
      </section>

      <section className="share-card-admin-grid" aria-label="分享模板列表">
        {SHARE_CARD_TEMPLATES.map((template) => {
          const selected = settings.activeTemplate === template.id;
          const effective = effectiveTemplate === template.id;
          return (
            <article
              key={template.id}
              className={`card share-card-admin-option template-${template.id}${selected ? " is-selected" : ""}`}
            >
              <div className="share-card-admin-preview">
                <small>OPENBIBLE · 每日读经</small>
                <blockquote>你的话是我脚前的灯，是我路上的光。</blockquote>
                <strong>— 诗篇 119:105</strong>
                <span>扫码阅读完整经文</span>
              </div>
              <div className="share-card-admin-option-info">
                <div>
                  <strong>{template.name}</strong>
                  {effective && <em>当前生效</em>}
                </div>
                <p>{template.description}</p>
              </div>
              <form action={selectShareCardTemplate}>
                <input type="hidden" name="template" value={template.id} />
                <button type="submit" disabled={selected}>
                  {selected ? "已设为起始模板" : "设为起始模板"}
                </button>
              </form>
            </article>
          );
        })}
      </section>
    </>
  );
}
