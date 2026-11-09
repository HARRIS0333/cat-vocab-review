import { Component, type ErrorInfo, type PropsWithChildren } from "react";

type PwaNoticeBoundaryState = {
  hasError: boolean;
};

export class PwaNoticeBoundary extends Component<
  PropsWithChildren,
  PwaNoticeBoundaryState
> {
  state: PwaNoticeBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PwaNoticeBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // PWA notices are optional; keep their failures out of the practice flow.
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
