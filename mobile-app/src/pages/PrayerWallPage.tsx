import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppBack } from "../hooks/useAppBack";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { fetchPrayerWall, postWallPrayer, toggleWallAmen, type WallPrayer } from "../data/prayer-wall";

// ── 祷告墙：弟兄姊妹的代祷做成一面「便签墙」 ──
// 每张便签按帖子 id 的散列取一个柔和底色与一个微小倾角（稳定不抖动），
// 两列砖石排布；墙上一次最多贴 WALL_SIZE 张，每隔几秒随机揭下一张、
// 换上池子里还没亮相的一张——所有人的祷告轮流被看见。

const WALL_SIZE = 12;
const ROTATE_EVERY_MS = 5000;

// 跳去登录前暂存草稿；登录回来自动恢复，不让用户白写一遍
const DRAFT_KEY = "ob.prayer-wall-draft";

// 便签底色与高亮五色同一家族：金、绿、蓝、粉、紫的纸感浅色
const NOTE_TINTS = 5;

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(iso));
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function PrayerWallPage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/me/prayers");
  const [pool, setPool] = useState<WallPrayer[] | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY) ?? "";
      sessionStorage.removeItem(DRAFT_KEY);
      return saved;
    } catch {
      return "";
    }
  });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const composerFocusedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchPrayerWall().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.message);
        setPool([]);
        return;
      }
      setPool(result.prayers);
      // 首批上墙：随机抽取，让每次打开看到的组合都不一样
      const shuffled = [...result.prayers].sort(() => Math.random() - 0.5);
      setVisibleIds(shuffled.slice(0, WALL_SIZE).map((prayer) => prayer.id));
    });
    return () => { active = false; };
  }, []);

  // 轮换：候补便签多于墙位时，定时随机换一张（写代祷时暂停，避免版面跳动；
  // 用户声明了减少动态效果时，正在读的便签不应被换走，整个轮换停用）
  useEffect(() => {
    if (!pool || pool.length <= WALL_SIZE) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden || composerFocusedRef.current) return;
      setVisibleIds((current) => {
        const hidden = pool.filter((prayer) => !current.includes(prayer.id));
        if (!hidden.length || !current.length) return current;
        const slot = Math.floor(Math.random() * current.length);
        const next = [...current];
        next[slot] = pickRandom(hidden).id;
        return next;
      });
    }, ROTATE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [pool]);

  const visiblePrayers = useMemo(() => {
    if (!pool) return [];
    const byId = new Map(pool.map((prayer) => [prayer.id, prayer]));
    return visibleIds.map((id) => byId.get(id)).filter((prayer): prayer is WallPrayer => Boolean(prayer));
  }, [pool, visibleIds]);

  const amen = async (prayer: WallPrayer) => {
    // 乐观更新：墙是即时反馈的地方
    const optimistic = {
      ...prayer,
      amenByMe: !prayer.amenByMe,
      amenCount: Math.max(0, prayer.amenCount + (prayer.amenByMe ? -1 : 1)),
    };
    setPool((current) => current?.map((item) => (item.id === prayer.id ? optimistic : item)) ?? current);
    const result = await toggleWallAmen(prayer.id);
    if (!result.ok) {
      setPool((current) => current?.map((item) => (item.id === prayer.id ? prayer : item)) ?? current);
      if (result.status === 401) navigate("/me/login", { state: { from: "/prayer-wall" } });
      else setFeedback(result.message);
      return;
    }
    setPool((current) => current?.map((item) =>
      item.id === prayer.id ? { ...item, amenByMe: result.amenByMe, amenCount: result.amenCount } : item,
    ) ?? current);
  };

  const submit = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setFeedback("");
    const result = await postWallPrayer(content);
    setSending(false);
    if (!result.ok) {
      if (result.status === 401) {
        // 草稿先存起来再去登录，登录回来自动填回输入框
        try { sessionStorage.setItem(DRAFT_KEY, content); } catch { /* 存不了就算了 */ }
        navigate("/me/login", { state: { from: "/prayer-wall" } });
      } else {
        setFeedback(result.message);
      }
      return;
    }
    if ("pending" in result) {
      setDraft("");
      setFeedback(result.message);
      return;
    }
    setDraft("");
    setPool((current) => [result.prayer, ...(current ?? [])]);
    // 自己刚贴的便签立即上墙（放在第一格），其余顺延
    setVisibleIds((current) => [result.prayer.id, ...current].slice(0, WALL_SIZE));
    setFeedback("已贴上祷告墙 🙏");
    window.setTimeout(() => setFeedback((message) => (message === "已贴上祷告墙 🙏" ? "" : message)), 2200);
  };

  return (
    <div className="screen prayer-wall-screen">
      <UnifiedHeader title="祷告墙" subtitle="彼此代祷" ariaLabel="祷告墙" onBack={goBack} backLabel="返回" />

      <main className="screen-scroll prayer-wall-scroll">
        {pool === null ? (
          <div className="prayer-wall-loading">正在取下墙上的便签…</div>
        ) : loadError ? (
          <EmptyState art="inbox" title="祷告墙暂时打不开" desc={loadError} />
        ) : pool.length === 0 ? (
          <EmptyState
            art="inbox"
            title="墙上还空着"
            desc="写下第一条代祷，让弟兄姊妹为你祷告"
          />
        ) : (
          <div className="prayer-wall" aria-label="代祷便签墙">
            {visiblePrayers.map((prayer) => {
              const hash = hashId(prayer.id);
              const tint = hash % NOTE_TINTS;
              const tilt = ((hash % 9) - 4) * 0.55; // -2.2° ~ +2.2°
              return (
                <article
                  key={prayer.id}
                  className={`prayer-note tint-${tint}`}
                  style={{ "--note-tilt": `${tilt}deg` } as React.CSSProperties}
                >
                  <header>
                    <span className="prayer-note-avatar" style={{ background: prayer.author.avatarColor }}>
                      {Array.from(prayer.author.name)[0] ?? "·"}
                    </span>
                    <b>{prayer.author.name}</b>
                    <time>{relativeTime(prayer.createdAt)}</time>
                  </header>
                  <p>{prayer.content}</p>
                  <button
                    type="button"
                    className={`prayer-note-amen${prayer.amenByMe ? " is-active" : ""}`}
                    aria-pressed={prayer.amenByMe}
                    aria-label={`${prayer.amenByMe ? "取消阿们" : "阿们，我为你祷告"}，已有 ${prayer.amenCount} 人`}
                    onClick={() => void amen(prayer)}
                  >
                    🙏 {prayer.amenByMe ? "已阿们" : "阿们"}{prayer.amenCount > 0 ? ` ${prayer.amenCount}` : ""}
                  </button>
                </article>
              );
            })}
          </div>
        )}
        {pool !== null && pool.length > WALL_SIZE && (
          <p className="prayer-wall-hint">墙上共有 {pool.length} 条代祷，正在轮流展示</p>
        )}
      </main>

      <div className="prayer-wall-composer">
        {feedback && <div role="status" className="prayer-wall-feedback">{feedback}</div>}
        <form
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <input
            value={draft}
            maxLength={300}
            placeholder="写下你的代祷，贴上这面墙…"
            aria-label="写下你的代祷"
            disabled={sending}
            onFocus={() => { composerFocusedRef.current = true; }}
            onBlur={() => { composerFocusedRef.current = false; }}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button data-icon-button="primary" type="submit" aria-label="贴上祷告墙" disabled={sending || !draft.trim()}>
            <Icon name="arrow-up" size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
