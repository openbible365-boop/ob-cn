import { useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
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
  const goBack = useAppBack("/me");
  const [items, setItems] = useState<PrayerItem[]>(getPrayers);
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
        className="prayer-remove"
        aria-label="删除这条祷告事项"
        onClick={() => {
          if (window.confirm("删除这条祷告事项？")) setItems(removePrayer(item.id));
        }}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );

  return (
    <div className="screen me-subpage">
      <UnifiedHeader
        title="祷告清单"
        subtitle={active.length ? `${active.length} 项代求中` : "常常祷告"}
        ariaLabel="祷告清单"
        onBack={goBack}
        backLabel="返回我的"
      />
      <main className="screen-scroll me-detail-scroll">
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
        {/* 存储说明紧跟输入框：写之前就知道记在哪里 */}
        <p className="prayer-compose-note">祷告清单仅保存在本机。</p>

        {items.length === 0 && (
          <EmptyState
            art="prayer"
            title="还没有祷告事项"
            desc="把心里的挂念写下来，得着回应时记下那一天。社群里的代祷请求也可以一键收进来。"
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
