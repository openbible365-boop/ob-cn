import { Component, type ReactNode } from "react";

type State = { error: Error | null };

// 全局兜底：任何页面抛错都不该让整个 App 变成白屏。
// 「回到首页」用整页跳转而不是路由跳转——出错的组件树需要彻底重建。
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-crash" role="alert">
        <b>页面出了点问题</b>
        <p>刚才的操作触发了一个错误，你的笔记和本机数据不受影响。</p>
        <div className="app-crash-actions">
          <button type="button" onClick={() => this.setState({ error: null })}>重试</button>
          <button
            type="button"
            className="is-primary"
            onClick={() => {
              window.location.hash = "#/bible";
              window.location.reload();
            }}
          >
            回到首页
          </button>
        </div>
        <small>{this.state.error.message}</small>
      </div>
    );
  }
}
