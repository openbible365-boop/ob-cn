import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { bookName, getBookByCode, getVersion } from "../data/scripture";
import {
  fetchReadingPlans,
  updateReadingPlan,
  type ReadingPlan,
} from "../data/reading-plans";

function scopeLabel(plan: ReadingPlan) {
  if (plan.scope === "COMMUNITY") return plan.community?.name ?? "社群计划";
  if (plan.scope === "PERSONAL") return "我的计划";
  return "精选计划";
}

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
    navigate(`/bible?${query.toString()}`);
  };

  return (
    <div className="screen reading-plans-screen">
      <UnifiedHeader
        title="读经计划"
        subtitle={plans.length ? `${plans.length} 个` : "每日同行"}
        ariaLabel="个人与社群读经计划"
        onBack={() => navigate("/me")}
        backLabel="返回我的"
      />
      <main className="screen-scroll reading-plans-scroll">
        <header className="reading-plans-intro">
          <span><Icon name="calendar" size={19} /></span>
          <div>
            <h1>每天一段，持续读下去</h1>
            <p>个人计划只属于你；社群计划与群成员一起完成。</p>
          </div>
        </header>

        {message && <div className="reading-plan-feedback" role="status">{message}</div>}
        {error && (
          <div className="reading-plan-feedback is-error" role="alert">
            {error}<button type="button" onClick={() => void loadPlans()}>重试</button>
          </div>
        )}
        {loading && <div className="reading-plan-empty">正在读取计划…</div>}

        {!loading && plans.map((plan) => {
          const progress = plan.totalDays
            ? Math.round((plan.completedDays / plan.totalDays) * 100)
            : 0;
          const reference = todayReference(plan);
          return (
            <article className="reading-plan-card" key={plan.id}>
              <div className="reading-plan-card-top">
                <span className={`reading-plan-scope is-${plan.scope.toLowerCase()}`}>
                  {scopeLabel(plan)}
                </span>
                <small>{plan.completedDays}/{plan.totalDays} 天</small>
              </div>
              <h2>{plan.title}</h2>
              {plan.description && <p>{plan.description}</p>}
              <div className="reading-plan-progress" aria-label={`已完成${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              {plan.today && !plan.completedAt && (
                <button className="reading-plan-today" type="button" onClick={() => openToday(plan)}>
                  <span>
                    <small>第 {plan.today.dayNumber} 天</small>
                    <b>{plan.today.title || reference}</b>
                    {plan.today.title && <em>{reference}</em>}
                  </span>
                  <Icon name="chevron-right" size={17} />
                </button>
              )}
              <button
                className={`reading-plan-action${plan.completedAt ? " is-complete" : ""}`}
                type="button"
                disabled={busyId === plan.id || Boolean(plan.completedAt)}
                onClick={() => void runAction(plan)}
              >
                {plan.completedAt
                  ? <><Icon name="check" size={15} />计划已完成</>
                  : busyId === plan.id
                    ? "正在更新…"
                    : plan.enrolled
                      ? "完成今天的阅读"
                      : "加入计划"}
              </button>
            </article>
          );
        })}

        {!loading && !plans.length && !error && (
          <div className="reading-plan-empty">暂时没有可加入的读经计划。</div>
        )}

        <p className="reading-plans-note">
          群主或管理员可通过社群助手创建群读经计划；个人计划内容仅当前账号可见。
        </p>
      </main>
    </div>
  );
}
