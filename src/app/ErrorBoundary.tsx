import { Component, type ErrorInfo, type PropsWithChildren } from "react";

type ErrorBoundaryProps = PropsWithChildren<{
  reload?: () => void;
}>;

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally keep error details local and out of logs or UI.
  }

  private reload = () => {
    if (this.props.reload) {
      this.props.reload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="fatal-error" role="alert" aria-labelledby="fatal-error-heading">
        <div className="fatal-error__mascot" aria-hidden="true">
          小桃猫
        </div>
        <h1 id="fatal-error-heading">页面遇到了一点问题</h1>
        <p>小桃猫暂时没能完成这一页。已写的笔迹不会被上传或公开。</p>
        <p>重新加载后可以继续使用本机保存的学习进度。</p>
        <button className="button button-primary" type="button" onClick={this.reload}>
          重新加载应用
        </button>
      </section>
    );
  }
}
