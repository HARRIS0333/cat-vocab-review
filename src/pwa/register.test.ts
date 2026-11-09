import { describe, expect, it, vi } from "vitest";
import { setupPwa, type PwaHandlers } from "./register";

type RegisterOptions = {
  immediate?: boolean;
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
  onRegisterError?: (error: unknown) => void;
};

describe("PWA registration controller", () => {
  it("wires offline-ready, update, update-application, and error callbacks", async () => {
    const onOfflineReady = vi.fn();
    const onNeedRefresh = vi.fn();
    const onRegisterError = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn((options: RegisterOptions) => {
      options.onOfflineReady?.();
      options.onNeedRefresh?.();
      return reload;
    });

    const controller = setupPwa(
      { onOfflineReady, onNeedRefresh, onRegisterError },
      register as never,
    );

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onOfflineReady,
        onNeedRefresh,
        onRegisterError,
      }),
    );
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
    expect(onNeedRefresh).toHaveBeenCalledTimes(1);

    await controller.update();
    expect(reload).toHaveBeenCalledWith(true);
  });

  it("forwards registration failures without throwing", () => {
    const error = new Error("registration failed");
    const onRegisterError = vi.fn();
    const handlers: PwaHandlers = {
      onOfflineReady: vi.fn(),
      onNeedRefresh: vi.fn(),
      onRegisterError,
    };
    const register = vi.fn((options: RegisterOptions) => {
      options.onRegisterError?.(error);
      return vi.fn().mockResolvedValue(undefined);
    });

    expect(() => setupPwa(handlers, register as never)).not.toThrow();
    expect(onRegisterError).toHaveBeenCalledWith(error);
  });
});
