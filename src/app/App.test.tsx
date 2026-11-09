import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLoadCacheForTests } from "../content/load-content";
import {
  createSessionSummary,
  saveSessionSummary,
} from "../features/session/session-summary";
import { makeContentFixture } from "../test/fixtures";
import { App } from "./App";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("App", () => {
  beforeEach(() => {
    clearLoadCacheForTests();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(makeContentFixture())),
    );
    window.location.hash = "#/";
  });

  it("renders the product name on the home route", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "小桃猫生字屋" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "选择课目" }),
    ).toBeInTheDocument();
  });

  it("renders the practice shell with real mode links", async () => {
    window.location.hash = "#/lesson/lesson-1/write";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "1 观潮" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "认读" })).toHaveAttribute(
      "href",
      "#/lesson/lesson-1/read",
    );
    expect(screen.getByRole("link", { name: "书写" })).toHaveAttribute(
      "href",
      "#/lesson/lesson-1/write",
    );
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute(
      "href",
      "#/",
    );
  });

  it("renders summary and the about page with loaded textbook metadata", async () => {
    window.location.hash = "#/lesson/lesson-1/summary?mode=read";
    const { unmount } = render(<App />);
    expect(
      await screen.findByRole("heading", { name: "本次练习结果" }),
    ).toBeInTheDocument();
    unmount();

    window.location.hash = "#/about";
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "关于与许可" }),
    ).toBeInTheDocument();
    expect(screen.getByText("fixture-content-id")).toBeInTheDocument();
  });

  it("shows a recoverable page for a well-formed unknown group", async () => {
    window.location.hash = "#/lesson/not-found/read";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "找不到这课" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute(
      "href",
      "#/",
    );
  });

  it("falls back to home for invalid route syntax", async () => {
    window.location.hash = "#/lesson/lesson-1/magic";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "选择课目" }),
    ).toBeInTheDocument();
  });

  it("uses a readable title for blank group data", async () => {
    const content = makeContentFixture();
    const group = content.groups[0]!;
    content.groups = [{ ...group, title: "   ", unit: "   " }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(content)));
    window.location.hash = "#/lesson/lesson-1/read";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "未命名课目" }),
    ).toBeInTheDocument();
  });

  it("starts a fresh recognition session when the route changes without unmounting", async () => {
    window.location.hash = "#/lesson/lesson-1/read";
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "显示“盐”的拼音和读音" }),
    ).toBeInTheDocument();

    act(() => {
      window.location.hash = "#/lesson/lesson-2/read";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      await screen.findByRole("button", { name: "显示“昧”的拼音和读音" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "显示“盐”的拼音和读音" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /显示“昧”/ }));
    await userEvent.click(screen.getByRole("button", { name: "认识" }));
    await userEvent.click(screen.getByRole("button", { name: /显示“坠”/ }));
    await userEvent.click(screen.getByRole("button", { name: "还不熟" }));

    expect(window.location.hash).toBe(
      "#/lesson/lesson-2/summary?mode=read",
    );
    const progress = localStorage.getItem("cat-vocab-progress-v1") ?? "";
    expect(progress).toContain("lesson-2:昧:mèi");
    expect(progress).toContain("lesson-2:坠:zhuì");
    expect(progress).not.toContain("lesson-1:盐:yán");
  });

  it("reloads summary content when the summary route changes", async () => {
    saveSessionSummary(
      createSessionSummary("lesson-1", "read", [
        { id: "a", char: "浩", pinyin: "hào", result: "review", hadError: true },
      ]),
    );
    saveSessionSummary(
      createSessionSummary("lesson-2", "write", [
        { id: "b", char: "昧", pinyin: "mèi", result: "review", hadError: true },
      ]),
    );
    window.location.hash = "#/lesson/lesson-1/summary?mode=read";
    render(<App />);

    expect(await screen.findByText("浩")).toBeInTheDocument();

    act(() => {
      window.location.hash = "#/lesson/lesson-2/summary?mode=write";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(await screen.findByText("昧")).toBeInTheDocument();
    expect(screen.queryByText("浩")).not.toBeInTheDocument();
  });
});
