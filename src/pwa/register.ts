import { registerSW } from "virtual:pwa-register";

export type PwaHandlers = {
  onOfflineReady(): void;
  onNeedRefresh(): void;
  onRegisterError?(error: unknown): void;
};

type RegisterOptions = {
  immediate?: boolean;
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
  onRegisterError?: (error: unknown) => void;
};

type Registrar = (
  options: RegisterOptions,
) => (reloadPage?: boolean) => Promise<void>;

export function setupPwa(
  handlers: PwaHandlers,
  register: Registrar = registerSW,
): { update(): Promise<void> } {
  const update = register({
    immediate: true,
    onOfflineReady: handlers.onOfflineReady,
    onNeedRefresh: handlers.onNeedRefresh,
    onRegisterError: handlers.onRegisterError,
  });

  return { update: () => update(true) };
}
