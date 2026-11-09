import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProgressStore } from "./progress-store";
import { ProgressProvider, useProgress } from "./ProgressProvider";

function Probe() {
  const { store } = useProgress();
  const snapshot = store.getSnapshot();
  return (
    <>
      <output>{Object.keys(snapshot.state.items).length}</output>
      {snapshot.warning ? <p role="status">{snapshot.warning}</p> : null}
      <button
        onClick={() => store.recordRecognition("lesson-1:浩:hào", "known")}
      >
        记录
      </button>
    </>
  );
}

describe("ProgressProvider", () => {
  it("re-renders subscribers after progress changes", async () => {
    const storage = { getItem: () => null, setItem() {}, removeItem() {} };
    const store = createProgressStore(storage, "v1");
    render(
      <ProgressProvider store={store}>
        <Probe />
      </ProgressProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "记录" }));

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("creates its default store once across parent rerenders", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const { rerender } = render(
      <ProgressProvider contentVersion="v1" storage={storage}>
        <Probe />
      </ProgressProvider>,
    );

    rerender(
      <ProgressProvider contentVersion="v1" storage={storage}>
        <Probe />
      </ProgressProvider>,
    );

    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("falls back to memory-only progress when localStorage cannot be acquired", async () => {
    const localStorageGetter = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

    try {
      render(
        <ProgressProvider contentVersion="v1">
          <Probe />
        </ProgressProvider>,
      );

      expect(
        screen.getByText("无法读取本地进度，已从空进度继续"),
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "记录" }));
      expect(screen.getByText("1")).toBeInTheDocument();
    } finally {
      localStorageGetter.mockRestore();
    }
  });

  it("rejects useProgress outside the provider with a clear message", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      "useProgress 必须在 ProgressProvider 内使用",
    );

    consoleError.mockRestore();
  });
});
