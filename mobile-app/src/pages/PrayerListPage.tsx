import { useEffect, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { SkeletonScreen } from "../components/SkeletonScreen";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { ANDROID_BACK_EVENT } from "../native/android-back";
import { hapticLight } from "../native/haptics";
import { fetchCommunityGroups } from "../data/community";
import {
  fetchCommunityPosts,
  performWorkspaceAction,
  type WorkspacePost,
} from "../data/community-workspace";
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

// 代祷墙条目：帖子 + 它来自哪个社群（阿门动作要带 communityId）
type WallItem = { post: WorkspacePost; communityId: string; communityName: string };

function shuffle<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function PrayerListPage() {
  const goBack = useAppBack("/me");
  const [items, setItems] = useState<PrayerItem[]>(getPrayers);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"mine" | "wall">("mine");
  const [wall, setWall] = useState<WallItem[] | null>(null);
  const [wallError, setWallError] = useState("");
  const [opened, setOpened] = useState<WallItem | null>(null);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

  // 代祷墙：聚合各社群的 PRAYER 帖，随机排布——每次进来看到的面孔都不同
  useEffect(() => {
    if (tab !== "wall" || wall !== null) return;
    let cancelled = false;
    (async () => {
      const directory = await fetchCommunityGroups();
      if (!directory.ok) {
        if (!cancelled) setWallError(directory.message);
        return;
      }
      const results = await Promise.all(
        directory.groups.slice(0, 6).map(async (group) => {
          const posts = await fetchCommunityPosts(group.id);
          if (!posts.ok) return [] as WallItem[];
          return posts.posts
            .filter((post) => post.postType === "PRAYER")
            .map((post) => ({ post, communityId: group.id, communityName: group.name }));
        }),
      );
      if (cancelled) return;
      setWall(shuffle(results.flat()));
    })();
    return () => { cancelled = true; };
  }, [tab, wall]);

  // 安卓返回键先收起代祷详情
  useEffect(() => {
    const close = (event: Event) => {
      if (!opened) return;
      event.preventDefault();
      setOpened(null);
    };
    window.addEventListener(ANDROID_BACK_EVENT, close);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, close);
  }, [opened]);

  // 阿门：乐观更新墙面与详情，失败再回滚
  const toggleAmen = async (target: WallItem) => {
    hapticLight();
    const apply = (liked: boolean, delta: number) => {
      const patch = (entry: WallItem) =>
        entry.post.id === target.post.id
          ? { ...entry, post: { ...entry.post, likedByMe: liked, likeCount: Math.max(0, entry.post.likeCount + delta) } }
          : entry;
      setWall((current) => current?.map(patch) ?? current);
      setOpened((current) => (current && current.post.id === target.post.id ? patch(current) : current));
    };
    const nextLiked = !target.post.likedByMe;
    apply(nextLiked, nextLiked ? 1 : -1);
    const result = await performWorkspaceAction(target.communityId, { action: "TOGGLE_LIKE", postId: target.post.id });
    if (!result.ok) apply(!nextLiked, nextLiked ? -1 : 1);
  };

  const saveToMine = (target: WallItem) => {
    setItems(addPrayer(target.post.content, "community", target.communityName));
    setSavedPostIds((current) => new Set(current).add(target.post.id));
  };

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
      <div className="record-tabs" role="tablist" aria-label="祷告栏目">
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>我的祷告</button>
        <button type="button" role="tab" aria-selected={tab === "wall"} className={tab === "wall" ? "active" : ""} onClick={() => setTab("wall")}>代祷墙</button>
      </div>
      <main className="screen-scroll me-detail-scroll">
        {tab === "wall" ? (
          <>
            {wallError && (
              <div className="annotation-status-card" role="alert">
                {wallError}
                <button type="button" className="empty-state-action" onClick={() => { setWallError(""); setWall(null); }}>重试</button>
              </div>
            )}
            {!wallError && wall === null && <SkeletonScreen label="正在汇集代祷请求" />}
            {wall?.length === 0 && (
              <EmptyState
                art="prayer"
                title="还没有代祷请求"
                desc="在社群的「动态」里发一条代祷帖，弟兄姊妹就能在这里为你祷告。"
              />
            )}
            {wall && wall.length > 0 && (
              <div className="prayer-wall" aria-label="社群代祷请求">
                {wall.map((entry) => (
                  <button type="button" className="prayer-wall-card" key={entry.post.id} onClick={() => setOpened(entry)}>
                    <p>{entry.post.content}</p>
                    <span className="prayer-wall-meta">{entry.post.author.name} · {entry.communityName}</span>
                    <span className={`prayer-wall-amen${entry.post.likedByMe ? " is-mine" : ""}`}>
                      🙏 {entry.post.likedByMe ? "已为 TA 祷告" : "阿门"}{entry.post.likeCount > 0 ? ` · ${entry.post.likeCount}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
        <>
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
        </>
        )}
      </main>

      {/* 代祷详情：半屏抽屉，核心动作只有一个——阿门 */}
      {opened && (
        <>
          <div className="audio-player-scrim" onClick={() => setOpened(null)} />
          <section className="sheet prayer-amen-sheet" role="dialog" aria-modal="true" aria-label="代祷请求详情">
            <div className="prayer-amen-head">
              <span className="prayer-amen-kicker">🙏 {opened.communityName} · 代祷</span>
              <button data-icon-button="default" type="button" aria-label="关闭" onClick={() => setOpened(null)}><Icon name="x" size={20} /></button>
            </div>
            <p className="prayer-amen-text">{opened.post.content}</p>
            <div className="prayer-amen-meta">
              {opened.post.author.name} · {readableDate(opened.post.createdAt)}
              {opened.post.likeCount > 0 ? ` · ${opened.post.likeCount} 位弟兄姊妹已代祷` : ""}
            </div>
            <button
              type="button"
              className={`prayer-amen-button${opened.post.likedByMe ? " is-mine" : ""}`}
              onClick={() => void toggleAmen(opened)}
            >
              🙏 {opened.post.likedByMe ? "已为 TA 祷告 · 阿门" : "我为你祷告 · 阿门"}
            </button>
            <button
              type="button"
              className="prayer-amen-save"
              disabled={savedPostIds.has(opened.post.id)}
              onClick={() => saveToMine(opened)}
            >
              {savedPostIds.has(opened.post.id) ? "已收进我的清单" : "收进我的清单，持续代求"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
