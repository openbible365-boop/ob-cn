import { useEffect, useState } from "react";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { Icon } from "../components/Icon";
import { useAppBack } from "../hooks/useAppBack";
import { useSettings } from "../context/SettingsContext";
import { fetchMe, type SessionUser } from "../data/profile";
import {
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_FOOTER_NOTE,
  SUPPORT_PLANS,
  SUPPORT_WEB_URL,
} from "../data/donation";

export function DonatePage() {
  const { translate } = useSettings();
  const goBack = useAppBack("/me");
  const [period, setPeriod] = useState<"monthly" | "once">("monthly");
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => { if (!cancelled) setUser(result); });
    return () => { cancelled = true; };
  }, []);

  // 未登录视同免费档；登录后按后端 tier 标记「当前支持」
  const currentTier = user?.tier ?? "BASIC_FREE";

  const openSupport = (planId: string) => {
    // App 内不接支付：跳网页端完成（外部浏览器），带上档位与周期便于预选
    window.open(`${SUPPORT_WEB_URL}/?support=${planId}&period=${period}`, "_blank");
  };

  return (
    <div className="screen" style={{ background: "var(--surface)" }}>
      <UnifiedHeader
        ariaLabel={translate("奉献支持")}
        title={translate("奉献支持")}
        subtitle={translate("慧读圣经")}
        onBack={goBack}
      />
      <main className="screen-scroll donate-page">
        <header className="donate-head">
          <h1>{translate("我们需要您的支持")}</h1>
          <p>{translate("您的支持承担关键技术成本，使我们能服务更多人")}</p>
          <div className="donate-period" role="radiogroup" aria-label={translate("支持周期")}>
            {([
              ["monthly", "连续每月"],
              ["once", "单月支持"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={period === value}
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {translate(label)}
              </button>
            ))}
          </div>
        </header>

        {SUPPORT_PLANS.map((plan) => {
          const price = period === "monthly" ? plan.monthly : plan.once;
          const isCurrent = plan.tier === currentTier;
          return (
            <section
              className={`card donate-plan${plan.popular ? " is-popular" : ""}`}
              key={plan.id}
              aria-label={translate(plan.title)}
            >
              {plan.popular && <span className="donate-plan-badge">{translate("热门")}</span>}
              <h2>
                {plan.id !== "free" && <Icon name="sparkle" size={14} className="donate-plan-spark" />}
                {translate(plan.title)}
              </h2>
              <div className="donate-plan-price">
                <span className="donate-currency">$</span>
                <b>{price === null ? 0 : price}</b>
                <span className="donate-period-unit">{translate(period === "monthly" || plan.id === "free" ? "/月" : "/次")}</span>
              </div>
              {isCurrent ? (
                <button className="donate-plan-btn is-current" type="button" disabled>
                  {translate("当前支持")}
                </button>
              ) : plan.id === "free" ? null : (
                <button
                  className={`donate-plan-btn${plan.id === "supporter" ? " is-highlight" : ""}`}
                  type="button"
                  onClick={() => openSupport(plan.id)}
                >
                  {translate("立即支持")}
                </button>
              )}
              <ul className="donate-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Icon name="check" size={14} />
                    <span>{translate(feature)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <footer className="donate-foot">
          <p>
            <Icon name="info" size={13} /> {translate(SUPPORT_FOOTER_NOTE)}
          </p>
          <p className="donate-foot-contact">
            {translate("如有疑问可联系我们")}{" "}
            <a href={`mailto:${SUPPORT_CONTACT_EMAIL}`}>{SUPPORT_CONTACT_EMAIL}</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
