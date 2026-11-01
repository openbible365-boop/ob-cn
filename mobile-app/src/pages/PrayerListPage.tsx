import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppBack } from "../hooks/useAppBack";
import { useArmedConfirm } from "../hooks/useArmedConfirm";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import {
  addPrayer,
  getPrayers,
  removePrayer,
  toggleAnswered,
  type PrayerItem,
} from "../data/prayers";

function readableDate(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function PrayerListPage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/me");
  const [items, setItems] = useState<PrayerItem[]>(getPrayers);
  // 删除走页内二次确认（再点一次），不用 WebView 的英文 confirm 弹窗
  const { armedKey, confirm } = useArmedConfirm();
  const [draft, setDraft] = useState("");

  const active = items.filter((item) => !item.answeredAt);
  const answered = items.filter((item) => item.answeredAt);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setItems(addPrayer(text));
    setDraft("");
  };

  const row = (item: PrayerItem) => (
    <div className={`prayer-item${item.answeredAt ? " is-answered" : ""}`} key={item.id}>
      <button
        type="button"
        className="prayer-check"
        aria-label={item.answeredAt ? "取消已应允标记" : "标记为已应允"}
        aria-pressed={Boolean(item.answeredAt)}
        onClick={() => setItems(toggleAnswered(item.id))}
      >
        {item.answeredAt && <Icon name="check" size={13} />}
      </button>
      <div className="prayer-copy">
        <p>{item.text}</p>
        <small>
          {item.answeredAt
            ? `${readableDate(item.answeredAt)} 应允 · 记于 ${readableDate(item.createdAt)}`
            : `记于 ${readableDate(item.createdAt)}`}
          {item.source === "community" && item.sourceLabel ? ` · 来自${item.sourceLabel}` : ""}
        </small>
      </div>
      <button data-icon-button="danger"
        type="button"
        className={`prayer-remove${armedKey === item.id ? " is-armed" : ""}`}
        aria-label={armedKey === item.id ? "再点一次确认删除" : "删除这条祷告事项"}
        title={armedKey === item.id ? "再点一次确认删除" : "删除"}
        onClick={() => confirm(item.id, () => setItems(removePrayer(item.id)))}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );

  return (
    <div className="screen me-subpage">
      <UnifiedHeader
        title="祷告清单"
        // 代求中条数在下方分组标题里已有，副标题固定说明页面性质，不重复数据
        subtitle="私密祷告日记"
        ariaLabel="祷告清单"
        onBack={goBack}
        backLabel="返回我的"
      />
      <main className="screen-scroll me-detail-scroll">
        {/* 祷告墙入口：弟兄姊妹的代祷在那面「便签墙」上轮流展示 */}
        <button type="button" className="prayer-wall-banner" onClick={() => navigate("/prayer-wall")}>
          <span className="prayer-wall-banner-icon" aria-hidden="true">🙏</span>
          <span className="prayer-wall-banner-copy">
            <b>祷告墙</b>
            <small>弟兄姊妹公开的代祷 · 去为他们按下阿们</small>
          </span>
          <Icon name="chevron-right" size={16} />
        </button>

        <form
          className="prayer-compose"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            maxLength={200}
            placeholder="写下一个祷告事项…"
            aria-label="新的祷告事项"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" disabled={!draft.trim()}>记下</button>
        </form>
        {/* 页面身份一行讲完：私密日记（与公开的祷告墙相对）+ 圆圈交互的教学 */}
        <p className="prayer-compose-note">
          <Icon name="lock" size={12} />
          私密日记，仅存本机；蒙应允时点圆圈，记下神回应的日子。
        </p>

        {items.length === 0 && (
          <EmptyState
            art="prayer"
            title="还没有祷告事项"
            desc="把心里的挂念写下来，得着回应时记下那一天。"
          />
        )}

        {active.length > 0 && (
          <section className="prayer-section" aria-label="代求中">
            <div className="prayer-section-head"><b>代求中</b><span>{active.length}</span></div>
            <div className="prayer-list">{active.map(row)}</div>
          </section>
        )}

        {answered.length > 0 && (
          <section className="prayer-section" aria-label="已应允">
            <div className="prayer-section-head"><b>已应允</b><span>{answered.length}</span></div>
            <div className="prayer-list">{answered.map(row)}</div>
          </section>
        )}
      </main>
    </div>
  );
}
