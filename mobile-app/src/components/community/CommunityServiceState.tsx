import type { ReactNode } from "react";
import { Icon } from "../Icon";
import type {
  CommunityServiceHealth,
  CommunityServiceState,
} from "../../data/community-health";

const SERVICE_LABELS = {
  database: "数据库",
  ai: "AI 问答",
  upload: "文件上传",
} as const;

function stateLabel(state: CommunityServiceState) {
  if (state === "operational") return "正常";
  if (state === "unconfigured") return "未配置";
  if (state === "unknown") return "未知";
  return "不可用";
}

export function CommunityServiceSummary({
  health,
  compact = false,
}: {
  health: CommunityServiceHealth;
  compact?: boolean;
}) {
  return (
    <div
      className={`community-service-summary${compact ? " is-compact" : ""}`}
      aria-label="社群服务状态"
    >
      {(Object.keys(SERVICE_LABELS) as Array<keyof typeof SERVICE_LABELS>).map(
        (key) => {
          const service = health.services[key];
          return (
            <span
              key={key}
              className={`community-service-item is-${service.state}`}
              title={service.message}
            >
              <i aria-hidden="true" />
              <b>{SERVICE_LABELS[key]}</b>
              <em>{stateLabel(service.state)}</em>
            </span>
          );
        },
      )}
    </div>
  );
}

// 登录、权限和不存在都是确定的答复，展示服务状态板只会让人以为是系统故障；
// 只有服务端故障（5xx）和网络失败才需要说明各项服务的状态。
function isServiceFailureStatus(status?: number | null) {
  return typeof status !== "number" || status === 0 || status >= 500;
}

export function CommunityErrorState({
  title = "服务暂时不可用",
  message,
  status,
  health,
  onRetry,
  onBack,
  actions,
}: {
  title?: string;
  message: string;
  status?: number | null;
  health?: CommunityServiceHealth | null;
  onRetry: () => void;
  onBack: () => void;
  actions?: ReactNode;
}) {
  // 三项全是「未知」说明连状态接口都没连上，这块状态板不提供任何信息，只会添乱
  const healthKnown = Boolean(health)
    && Object.values(health!.services).some((service) => service.state !== "unknown");
  const showHealth = healthKnown && isServiceFailureStatus(status);
  // 各处文案习惯写成「服务暂时不可用，暂时无法读取社群」，标题已经说了前半句，正文不再重复
  const body = message.startsWith(title)
    ? message.slice(title.length).replace(/^[，,。\s]+/u, "") || "请检查网络连接后重试"
    : message;
  return (
    <section className="community-error-state" role="alert">
      <span className="community-error-state-icon">
        <Icon name="info" size={20} />
      </span>
      <div className="community-error-state-copy">
        <b>{title}</b>
        <p>{body}</p>
      </div>
      {showHealth && health && <CommunityServiceSummary health={health} />}
      {actions}
      <div className="community-error-state-actions">
        <button type="button" className="is-primary" onClick={onRetry}>
          重试
        </button>
        <button type="button" onClick={onBack}>
          返回
        </button>
      </div>
    </section>
  );
}

export function CommunityDegradedNotice({
  health,
  onRetry,
  onBack,
  children,
}: {
  health?: CommunityServiceHealth | null;
  onRetry: () => void;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="community-degraded-notice" role="status">
      <div className="community-degraded-notice-copy">
        <Icon name="info" size={16} />
        <span>{children}</span>
      </div>
      {health && <CommunityServiceSummary health={health} compact />}
      <div className="community-degraded-notice-actions">
        <button type="button" onClick={onRetry}>重试</button>
        <button type="button" onClick={onBack}>返回</button>
      </div>
    </div>
  );
}
