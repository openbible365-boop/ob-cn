import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { UnifiedHeader } from "../components/UnifiedHeader";
import { CommunityErrorState } from "../components/community/CommunityServiceState";
import { createCommunity } from "../data/community";
import {
  fetchCommunityServiceHealth,
  type CommunityServiceHealth,
} from "../data/community-health";

const COLORS = ["var(--yellow)", "var(--purple)", "var(--orange)", "var(--pink)"];
const COLOR_NAMES = ["暖黄色", "慧读紫", "珊瑚橙", "玫红色"];

// 创建社群（design 4e）
export function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [desc, setDesc] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [serviceHealth, setServiceHealth] = useState<CommunityServiceHealth | null>(null);

  const abbreviationLength = Array.from(abbreviation.trim()).length;
  const canSubmit =
    name.trim().length > 0 &&
    abbreviationLength >= 1 &&
    abbreviationLength <= 2 &&
    !isSubmitting;

  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    setErrorStatus(null);
    setIsSubmitting(true);
    const result = await createCommunity({
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      description: desc.trim(),
      avatarColor: COLORS[colorIdx],
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setErrorStatus(result.status ?? null);
      const health = await fetchCommunityServiceHealth();
      setServiceHealth(health.health);
      return;
    }
    navigate(`/community/${result.group.id}`, { replace: true });
  };

  return (
    <div className="screen community-settings-screen">
      <UnifiedHeader title="创建社群" subtitle="新群组" ariaLabel="创建社群" onBack={() => navigate(-1)} backLabel="返回社群" />

      <div className="screen-scroll community-settings-scroll">
        <div className="community-create-identity">
          <span className="community-create-avatar" style={{ background: COLORS[colorIdx] }}>
            {abbreviation.trim() || "群"}
            <i aria-hidden="true"><Icon name="camera" size={14} /></i>
          </span>
          <small>选择头像底色</small>
          <div className="community-create-colors">
            {COLORS.map((color, index) => (
              <button
                key={color}
                type="button"
                onClick={() => setColorIdx(index)}
                aria-label={`选择${COLOR_NAMES[index]}头像底色`}
                aria-pressed={index === colorIdx}
                title={COLOR_NAMES[index]}
                className={index === colorIdx ? "is-active" : ""}
              >
                <span aria-hidden="true" style={{ background: color }} />
              </button>
            ))}
          </div>
        </div>

        <div className="card community-form-card">
          <label className="community-form-field">
            <span>社群名称<em>{name.length}/20</em></span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 20))}
              placeholder="例如：活泉教会"
            />
          </label>
          <label className="community-form-field">
            <span>社群简称<small>1 到 2 个字 · 全域唯一</small><em>{abbreviationLength}/2</em></span>
            <input
              value={abbreviation}
              onChange={(event) => {
                setAbbreviation(Array.from(event.target.value).slice(0, 2).join(""));
                setError("");
              }}
              placeholder="例如：活泉"
            />
          </label>
        </div>

        <div className="card community-form-card">
          <label className="community-form-field">
            <span>社群简介<small>可留空</small><em>{desc.length}/60</em></span>
            <textarea
              value={desc}
              onChange={(event) => setDesc(event.target.value.slice(0, 60))}
              placeholder="一句话介绍这个社群…"
              rows={3}
            />
          </label>
        </div>

        <div className="community-create-tier-note">
          <Icon name="star" size={16} />
          <span>新社群默认为「初阶」：50 成员上限 · 基础 AI 助手额度。可在社群设置中升级。</span>
        </div>

        {error ? (
          <CommunityErrorState
            title={errorStatus === 401 ? "请先登录" : errorStatus === 403 ? "无法创建社群" : undefined}
            message={error}
            status={errorStatus}
            health={serviceHealth}
            onRetry={() => void submit()}
            onBack={() => navigate("/community")}
          />
        ) : null}

        <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
          {isSubmitting ? "正在创建…" : "创建社群"}
        </button>
        <div className="disclaimer">创建即表示同意平台《社群公约》与内容规范；付费升级当前尚未开放。</div>
      </div>
    </div>
  );
}
