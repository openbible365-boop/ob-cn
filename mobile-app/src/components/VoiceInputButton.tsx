import { Icon } from "./Icon";

export function VoiceInputButton({
  isSupported,
  isListening,
  disabled = false,
  onClick,
}: {
  isSupported: boolean;
  isListening: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const label = !isSupported
    ? "当前浏览器不支持语音输入"
    : isListening
      ? "停止语音输入"
      : "开始语音输入";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isListening}
      title={label}
      disabled={disabled || !isSupported}
      onClick={onClick}
      className={`icon-btn voice-input-btn${isListening ? " is-listening" : ""}`}
    >
      <Icon name="mic" size={19} />
    </button>
  );
}
