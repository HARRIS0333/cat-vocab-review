import { useCallback, useEffect, useRef, useState } from "react";
import { setupPwa, type PwaHandlers } from "./register";

type PromptInitialState = {
  offlineReady?: boolean;
  needRefresh?: boolean;
  registerError?: boolean;
};

type PwaController = {
  update(): Promise<void>;
};

type PwaSetup = (handlers: PwaHandlers) => PwaController;

type UpdatePromptProps = {
  initialState?: PromptInitialState;
  setup?: PwaSetup;
};

type PromptState = {
  offlineReady: boolean;
  needRefresh: boolean;
  registerError: boolean;
  statusDismissed: boolean;
  updating: boolean;
};

export function UpdatePrompt({
  initialState,
  setup = setupPwa,
}: UpdatePromptProps) {
  const [state, setState] = useState<PromptState>({
    offlineReady: initialState?.offlineReady ?? false,
    needRefresh: initialState?.needRefresh ?? false,
    registerError: initialState?.registerError ?? false,
    statusDismissed: false,
    updating: false,
  });
  const setupRef = useRef(setup);
  const controllerRef = useRef<PwaController | null>(null);
  const registrationFailedRef = useRef(false);
  const startedRef = useRef(false);
  const handlersRef = useRef<PwaHandlers>({
    onOfflineReady: () => {
      registrationFailedRef.current = false;
      setState((current) => ({
        ...current,
        offlineReady: true,
        registerError: false,
        statusDismissed: false,
      }));
    },
    onNeedRefresh: () => {
      registrationFailedRef.current = false;
      setState((current) => ({
        ...current,
        needRefresh: true,
        registerError: false,
      }));
    },
    onRegisterError: () => {
      registrationFailedRef.current = true;
      setState((current) => ({
        ...current,
        offlineReady: false,
        registerError: true,
        statusDismissed: false,
      }));
    },
  });

  const beginRegistration = useCallback(() => {
    try {
      controllerRef.current = setupRef.current(handlersRef.current);
      registrationFailedRef.current = false;
      setState((current) =>
        current.registerError
          ? { ...current, registerError: false }
          : current,
      );
    } catch {
      registrationFailedRef.current = true;
      setState((current) => ({
        ...current,
        offlineReady: false,
        registerError: true,
        statusDismissed: false,
      }));
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    beginRegistration();
  }, [beginRegistration]);

  useEffect(() => {
    const retryRegistration = () => {
      if (registrationFailedRef.current) beginRegistration();
    };
    window.addEventListener("online", retryRegistration);
    return () => window.removeEventListener("online", retryRegistration);
  }, [beginRegistration]);

  async function applyUpdate() {
    const controller = controllerRef.current;
    if (!controller) return;

    setState((current) => ({ ...current, updating: true }));
    try {
      await controller.update();
      setState((current) => ({
        ...current,
        needRefresh: false,
        updating: false,
      }));
    } catch {
      setState((current) => ({
        ...current,
        registerError: true,
        statusDismissed: false,
        updating: false,
      }));
    }
  }

  const statusText = state.registerError
    ? "离线缓存暂时未完成，联网后可重试"
    : state.offlineReady
      ? "已可离线使用"
      : null;
  const showStatus = Boolean(statusText && !state.statusDismissed);

  if (!showStatus && !state.needRefresh) return null;

  return (
    <div className="pwa-notices" aria-label="应用状态">
      {showStatus ? (
        <div className="pwa-status">
          <p role="status" aria-label="离线缓存状态" aria-live="polite">
            {statusText}
          </p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              setState((current) => ({
                ...current,
                statusDismissed: true,
              }))
            }
          >
            知道了
          </button>
        </div>
      ) : null}

      {state.needRefresh ? (
        <aside
          className="pwa-update"
          aria-labelledby="pwa-update-title"
          aria-describedby="pwa-update-description"
        >
          <div>
            <h2 id="pwa-update-title">发现新版本</h2>
            <p id="pwa-update-description">
              更新会重新加载页面，当前尚未提交的笔迹会丢失。应用只会在你确认后加载更新。
            </p>
          </div>
          <div className="pwa-update__actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  needRefresh: false,
                }))
              }
            >
              稍后更新
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={state.updating}
              onClick={applyUpdate}
            >
              {state.updating ? "正在更新…" : "更新应用"}
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
