import { useCallback, useEffect, useState } from "react";
import { useAppBack } from "../hooks/useAppBack";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { SkeletonScreen } from "../components/SkeletonScreen";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { getStreak, markTodayRead } from "../data/streak";
import { bookName, getBookByCode, getVersion } from "../data/scripture";
import { SHOW_COMMUNITY } from "../data/features";
import {
  fetchReadingPlans,
  updateReadingPlan,
  type ReadingPlan,
} from "../data/reading-plans";

function todayReference(plan: ReadingPlan) {
  if (!plan.today) return "";
  const version = getVersion(plan.today.translation);
  const book = getBookByCode(plan.today.book);
  const verses = plan.today.verseStart === plan.today.verseEnd
    ? String(plan.today.verseStart)
    : `${plan.today.verseStart}-${plan.today.verseEnd}`;
  return `${bookName(book, version)} ${plan.today.chapter}:${verses}`;
}

export function ReadingPlansPage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/me");
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await fetchReadingPlans();
    if (result.ok) setPlans(result.plans);
    else setError(result.message);
    setLoading(false);
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const runAction = async (plan: ReadingPlan) => {
    if (busyId) return;
    setBusyId(plan.id);
    setMessage("");
    const result = await updateReadingPlan(
      plan.enrolled ? "COMPLETE_TODAY" : "ENROLL",
      plan.id,
    );
    if (result.ok) {
      // 打卡成功计入连续读经天数（本机 streak）
      if (plan.enrolled) markTodayRead();
      setMessage(result.message);
      await loadPlans();
    } else setError(result.message);
    setBusyId("");
  };

  const openToday = (plan: ReadingPlan) => {
    if (!plan.today) return;
    const query = new URLSearchParams({
      t: plan.today.translation,
      bk: plan.today.book,
      c: String(plan.today.chapter),
      v: String(plan.today.verseStart),
    });
    // 带上计划上下文：阅读页在读完今日读段时就地浮出打卡胶囊，
    // 把「读完 → 打卡」的闭环闭在阅读现场，不用再折返这页。
    navigate(`/bible?${query.toString()}`, {
      state: {
        planCheckIn: {
          planId: plan.id,
          planTitle: plan.title,
          dayNumber: plan.today.dayNumber,
          book: plan.today.book,
          chapter: plan.today.chapter,
          verseEnd: plan.today.verseEnd,
        },
      },
    });
  };

  // 进行中的计划卡：今日读段是唯一主 CTA；手动打卡降级为兜底小动作
  const renderEnrolledCard = (plan: ReadingPlan) => {
    const progress = plan.totalDays
      ? Math.round((plan.completedDays / plan.totalDays) * 100)
      : 0;
    return (
      <article className="reading-plan-card" key={plan.id}>
        <div className="reading-plan-card-top">
          <h2>{plan.title}</h2>
          {/* 精选计划不打徽章（分组标题已说明）；社群/个人计划才需要来源标识 */}
          {plan.scope === "COMMUNITY" && <span className="reading-plan-scope is-community">{plan.community?.name ?? "社群"}</span>}
          {plan.scope === "PERSONAL" && <span className="reading-plan-scope is-personal">自建</span>}
          <small>{plan.completedDays}/{plan.totalDays} 天</small>
        </div>
        <div className="reading-plan-progress" aria-label={`已完成${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        {plan.completedAt ? (
          <div className="reading-plan-complete"><Icon name="check" size={15} />计划已完成，愿你继续持守阅读</div>
        ) : (
          <>
            {plan.today && (
              <button className="reading-plan-today" type="button" onClick={() => openToday(plan)}>
                <span className="reading-plan-today-copy">
                  <small>第 {plan.today.dayNumber} 天{plan.today.title ? ` · ${plan.today.title}` : ""}</small>
                  <b>{todayReference(plan)}</b>
                </span>
                <span className="reading-plan-go">去阅读<Icon name="chevron-right" size={14} /></span>
              </button>
            )}
            {/* 兜底：读了纸质圣经或跳过了阅读页的打卡提示时手动补卡 */}
            <button
              className="reading-plan-manual"
              type="button"
              disabled={busyId === plan.id}
              onClick={() => void runAction(plan)}
            >
              {busyId === plan.id ? "正在打卡…" : "已在别处读完？手动打卡"}
            </button>
          </>
        )}
      </article>
    );
  };

  // 可选计划卡：目录形态——标题 + 时长 + 简介 + 试读/加入，不渲染无意义的 0% 进度
  const renderAvailableCard = (plan: ReadingPlan) => (
    <article className="reading-plan-card is-available" key={plan.id}>
      <div className="reading-plan-card-top">
        <h2>{plan.title}</h2>
        {plan.scope === "COMMUNITY" && <span className="reading-plan-scope is-community">{plan.community?.name ?? "社群"}</span>}
        <span className="reading-plan-days">{plan.totalDays} 天</span>
      </div>
      {plan.description && <p>{plan.description}</p>}
      <div className="reading-plan-card-foot">
        {plan.today && (
          <button className="reading-plan-preview" type="button" onClick={() => openToday(plan)}>
            试读第 1 天 · {todayReference(plan)}
          </button>
        )}
        <button
          className="reading-plan-join"
          type="button"
          disabled={busyId === plan.id}
          onClick={() => void runAction(plan)}
        >
          {busyId === plan.id ? "加入中…" : "加入"}
        </button>
      </div>
    </article>
  );

  const mine = plans
    .filter((plan) => plan.enrolled)
    .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)));
  const available = plans.filter((plan) => !plan.enrolled);

  return (
    <div className="screen reading-plans-screen">
      <UnifiedHeader
        title="读经计划"
        subtitle={getStreak() > 0 ? `连续 ${getStreak()} 天` : "每日同行"}
        ariaLabel="读经计划"
        onBack={goBack}
        backLabel="返回我的"
      />
      <main className="screen-scroll reading-plans-scroll">
        {message && <div className="reading-plan-feedback" role="status">{message}</div>}
        {error && (
          <div className="reading-plan-feedback is-error" role="alert">
            {error}<button type="button" onClick={() => void loadPlans()}>重试</button>
          </div>
        )}
        {loading && <SkeletonScreen label="正在读取计划" />}

        {!loading && mine.length > 0 && (
          <section className="reading-plans-group" aria-label="我的计划">
            <h3>我的计划<span>{mine.length}</span></h3>
            {mine.map(renderEnrolledCard)}
          </section>
        )}

        {!loading && available.length > 0 && (
          <section className="reading-plans-group" aria-label="可选计划">
            <h3>可选计划<span>{available.length}</span></h3>
            {available.map(renderAvailableCard)}
          </section>
        )}

        {!loading && !plans.length && !error && (
          <EmptyState compact art="content" title="暂时没有读经计划" desc="新的计划上架后会出现在这里。" />
        )}

        {SHOW_COMMUNITY && (
          <p className="reading-plans-note">
            群主或管理员可通过社群助手创建群读经计划；个人计划内容仅当前账号可见。
          </p>
        )}
      </main>
    </div>
  );
}
