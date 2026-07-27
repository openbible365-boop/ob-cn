import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { fetchMyActivities, type MyActivity } from "../data/profile";

function activityTime(activity: MyActivity) {
  const start = new Date(activity.startAt);
  if (Number.isNaN(start.getTime())) return "时间待定";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);
}

export function MyActivitiesPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = () => {
    setLoading(true);
    setError("");
    void fetchMyActivities().then((result) => {
      if (result.ok) setActivities(result.activities);
      else setError(result.message);
      setLoading(false);
    });
  };

  useEffect(loadActivities, []);

  const grouped = useMemo(() => {
    const now = Date.now();
    const upcoming: MyActivity[] = [];
    const ended: MyActivity[] = [];
    for (const activity of activities) {
      const end = new Date(activity.endAt ?? activity.startAt).getTime();
      (end >= now ? upcoming : ended).push(activity);
    }
    ended.sort((a, b) => b.startAt.localeCompare(a.startAt));
    return [
      { label: "即将开始", items: upcoming },
      { label: "已结束", items: ended },
    ].filter((group) => group.items.length);
  }, [activities]);

  return (
    <div className="screen me-subpage">
      <UnifiedHeader
        title="我的活动"
        subtitle={`${activities.length} 项`}
        ariaLabel="我的活动"
        onBack={() => navigate("/me")}
        backLabel="返回我的"
      />
      <main className="screen-scroll me-detail-scroll">
        {loading && <div className="me-detail-state" role="status">正在读取报名活动…</div>}
        {!loading && error && (
          <div className="me-detail-state is-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={loadActivities}>重试</button>
          </div>
        )}
        {!loading && !error && activities.length === 0 && (
          <div className="me-detail-empty">
            <Icon name="calendar" size={22} />
            <b>还没有报名活动</b>
            <span>在社群的「活动」页面报名后，会汇总显示在这里。</span>
            <button type="button" onClick={() => navigate("/community")}>浏览社群</button>
          </div>
        )}
        {grouped.map((group) => (
          <section className="me-activity-group" key={group.label}>
            <h2>{group.label}</h2>
            <div className="me-activity-list">
              {group.items.map((activity) => (
                <button
                  type="button"
                  key={activity.signupId}
                  onClick={() => navigate(`/community/${activity.community.id}?tab=events`)}
                >
                  <span className="me-activity-date">{activityTime(activity)}</span>
                  <b>{activity.title}</b>
                  <small>
                    {activity.community.name}
                    {activity.location ? ` · ${activity.location}` : ""}
                  </small>
                  <Icon name="chevron-right" size={15} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
