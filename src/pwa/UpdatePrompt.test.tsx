import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PwaHandlers } from "./register";
import { UpdatePrompt } from "./UpdatePrompt";

describe("UpdatePrompt", () => {
  it("shows offline readiness and lets the user postpone an update", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <UpdatePrompt
        initialState={{ offlineReady: true, needRefresh: true }}
        setup={() => ({ update })}
      />,
    );

    expect(
      screen.getByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("已可离线使用");
    expect(screen.getByText("发现新版本")).toBeInTheDocument();
    expect(screen.getByText(/只会在你确认后加载更新/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "稍后更新" }));
    expect(screen.queryByText("发现新版本")).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("only applies an update after the user explicitly asks", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    render(
      <UpdatePrompt
        initialState={{ needRefresh: true }}
        setup={() => ({ update })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "更新应用" }));
    expect(update).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText("发现新版本")).not.toBeInTheDocument(),
    );
  });

  it("lets the user dismiss offline readiness", async () => {
    render(
      <UpdatePrompt
        initialState={{ offlineReady: true }}
        setup={() => ({ update: vi.fn() })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(
      screen.queryByRole("status", { name: "离线缓存状态" }),
    ).not.toBeInTheDocument();
  });

  it("shows a later registration error after offline readiness was dismissed", async () => {
    let handlers: PwaHandlers | undefined;
    render(
      <UpdatePrompt
        initialState={{ offlineReady: true }}
        setup={(nextHandlers) => {
          handlers = nextHandlers;
          return { update: vi.fn() };
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(
      screen.queryByRole("status", { name: "离线缓存状态" }),
    ).not.toBeInTheDocument();

    act(() => handlers?.onRegisterError?.(new Error("registration failed")));

    expect(
      screen.getByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("离线缓存暂时未完成，联网后可重试");
  });

  it("shows an update failure even after the status was dismissed", async () => {
    const update = vi.fn().mockRejectedValue(new Error("update failed"));
    render(
      <UpdatePrompt
        initialState={{ offlineReady: true, needRefresh: true }}
        setup={() => ({ update })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "知道了" }));
    await userEvent.click(screen.getByRole("button", { name: "更新应用" }));

    expect(
      await screen.findByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("离线缓存暂时未完成，联网后可重试");
  });

  it("clears a registration error when offline readiness recovers", () => {
    let handlers: PwaHandlers | undefined;
    render(
      <UpdatePrompt
        setup={(nextHandlers) => {
          handlers = nextHandlers;
          return { update: vi.fn() };
        }}
      />,
    );

    act(() => handlers?.onRegisterError?.(new Error("registration failed")));
    expect(
      screen.getByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("离线缓存暂时未完成，联网后可重试");

    act(() => handlers?.onOfflineReady?.());
    expect(
      screen.getByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("已可离线使用");
    expect(
      screen.queryByText("离线缓存暂时未完成，联网后可重试"),
    ).not.toBeInTheDocument();
  });

  it("clears a registration error when update discovery recovers", () => {
    let handlers: PwaHandlers | undefined;
    render(
      <UpdatePrompt
        setup={(nextHandlers) => {
          handlers = nextHandlers;
          return { update: vi.fn() };
        }}
      />,
    );

    act(() => handlers?.onRegisterError?.(new Error("registration failed")));
    expect(
      screen.getByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("离线缓存暂时未完成，联网后可重试");

    act(() => handlers?.onNeedRefresh?.());
    expect(screen.getByText("发现新版本")).toBeInTheDocument();
    expect(
      screen.queryByText("离线缓存暂时未完成，联网后可重试"),
    ).not.toBeInTheDocument();
  });

  it("retries registration when connectivity returns after a setup failure", () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const setup = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("offline");
      })
      .mockReturnValue({ update });

    render(<UpdatePrompt setup={setup} />);
    expect(
      screen.getByRole("status", { name: "离线缓存状态" }),
    ).toHaveTextContent("离线缓存暂时未完成，联网后可重试");

    act(() => window.dispatchEvent(new Event("online")));

    expect(setup).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("离线缓存暂时未完成，联网后可重试"),
    ).not.toBeInTheDocument();
  });

  it("stacks status and update notices in one non-overlapping region", () => {
    render(
      <UpdatePrompt
        initialState={{ offlineReady: true, needRefresh: true }}
        setup={() => ({ update: vi.fn() })}
      />,
    );

    const status = screen.getByRole("status", { name: "离线缓存状态" });
    const update = screen.getByRole("complementary", {
      name: "发现新版本",
    });

    expect(status.closest(".pwa-notices")).toBe(update.parentElement);
  });

  it("connects live PWA callbacks once", () => {
    const setup = vi.fn(() => ({
      update: vi.fn().mockResolvedValue(undefined),
    }));
    render(<UpdatePrompt setup={setup} />);
    expect(setup).toHaveBeenCalledTimes(1);
  });
});
