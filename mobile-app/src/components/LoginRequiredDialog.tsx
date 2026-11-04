import { useEffect } from "react";
import { ANDROID_BACK_EVENT } from "../native/android-back";

interface LoginRequiredDialogProps {
  /** 弹窗标题 */
  title?: string;
  /** 说明文字 */
  message?: string;
  /** 关闭弹窗（取消 / 点遮罩 / 安卓返回键） */
  onClose: () => void;
  /** 点击「去登录」 */
  onLogin: () => void;
}

/**
 * 需要登录才能继续时的提示弹窗：取消 / 去登录
 * 样式沿用慧读删除、重命名弹窗，保持全站对话框一致
 */
export function LoginRequiredDialog({
  title = "尚未登录",
  message = "登录后即可使用该功能",
  onClose,
  onLogin,
}: LoginRequiredDialogProps) {
  // 安卓返回键优先关闭弹窗，而不是直接离开当前页面
  useEffect(() => {
    const close = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    window.addEventListener(ANDROID_BACK_EVENT, close);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, close);
  }, [onClose]);

  return (
    <div className="huidu-new-layer">
      <button className="huidu-new-scrim" type="button" aria-label="取消" onClick={onClose} />
      <section
        className="huidu-delete-dialog login-required-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        aria-describedby="login-required-message"
      >
        <h2 id="login-required-title">{title}</h2>
        <p id="login-required-message">{message}</p>
        <div>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="is-primary" onClick={onLogin} autoFocus>去登录</button>
        </div>
      </section>
    </div>
  );
}

