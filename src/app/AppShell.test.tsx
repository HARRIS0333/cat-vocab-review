import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgressStore } from "../progress/progress-store";
import { ProgressProvider } from "../progress/ProgressProvider";
import { HomePage } from "../features/home/HomePage";
import { makeContentFixture } from "../test/fixtures";
import lessonsCss from "../ui/lessons.css?raw";
import uiCss from "../ui/ui.css?raw";
import writingCss from "../features/writing/writing.css?raw";
import stylesCss from "../styles.css?raw";
import { AppShell } from "./AppShell";

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  );
}

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.location.hash = "#/";
});

describe("AppShell", () => {
  it("offers an accessible lesson drawer on narrow layouts", async () => {
    mockMatchMedia(false);
    render(
      <AppShell content={makeContentFixture()} currentRoute={{ name: "home" }}>
        <p>练习内容</p>
      </AppShell>,
    );

    const toggle = screen.getByRole("button", { name: "打开课目列表" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "lesson-drawer");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "选择课目" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /1 观潮/ })).toHaveAttribute(
      "href",
      "#/lesson/lesson-1/read",
    );
  });

  it("closes the drawer after choosing a lesson and restores trigger focus", async () => {
    mockMatchMedia(false);
    render(
      <AppShell content={makeContentFixture()} currentRoute={{ name: "home" }}>
        <p>练习内容</p>
      </AppShell>,
    );

    const toggle = screen.getByRole("button", { name: "打开课目列表" });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("link", { name: /2 繁星/ }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "选择课目" })).not.toBeInTheDocument();
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes the drawer with Escape and restores trigger focus", async () => {
    mockMatchMedia(false);
    render(
      <AppShell content={makeContentFixture()} currentRoute={{ name: "home" }}>
        <p>练习内容</p>
      </AppShell>,
    );

    const toggle = screen.getByRole("button", { name: "打开课目列表" });
    await userEvent.click(toggle);
    const close = screen.getByRole("button", { name: "关闭课目列表" });
    await waitFor(() => expect(close).toHaveFocus());

    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "选择课目" }),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("shows a fixed lesson sidebar instead of the drawer trigger on wide screens", () => {
    mockMatchMedia(true);
    render(
      <AppShell content={makeContentFixture()} currentRoute={{ name: "home" }}>
        <p>练习内容</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("complementary", { name: "课目列表" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开课目列表" }),
    ).not.toBeInTheDocument();
  });

  it("moves focus to the main content without changing the route", async () => {
    mockMatchMedia(false);
    render(
      <AppShell content={makeContentFixture()} currentRoute={{ name: "home" }}>
        <p>练习内容</p>
      </AppShell>,
    );

    await userEvent.click(
      screen.getByRole("link", { name: "跳到练习内容" }),
    );

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe("#/");
  });
});

describe("HomePage progress clearing", () => {
  it("clears progress only after explicit confirmation", async () => {
    const content = makeContentFixture();
    const store = createProgressStore(memoryStorage(), content.contentVersion);
    store.recordRecognition("lesson-2:昧:mèi", "known");
    store.setRecent("lesson-2", "read");
    const clearAll = vi.spyOn(store, "clearAll");

    render(
      <ProgressProvider store={store}>
        <HomePage content={content} />
      </ProgressProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "清除学习进度" }),
    );
    expect(
      screen.getByRole("dialog", { name: "清除全部学习进度？" }),
    ).toBeInTheDocument();
    expect(clearAll).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(clearAll).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "清除学习进度" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "清除进度" }));

    expect(clearAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("学习进度已清除");
    expect(screen.getByText("已掌握 0")).toBeInTheDocument();
    expect(screen.getByText("待复习 0")).toBeInTheDocument();
  });
});

describe("responsive CSS contract", () => {
  it("keeps safe areas, wide-screen columns, touch and motion rules explicit", () => {
    expect(stylesCss).toMatch(/--safe-top:\s*env\(safe-area-inset-top, 0px\)/);
    expect(stylesCss).toMatch(/--safe-right:\s*env\(safe-area-inset-right, 0px\)/);
    expect(stylesCss).toMatch(/--safe-bottom:\s*env\(safe-area-inset-bottom, 0px\)/);
    expect(stylesCss).toMatch(/--safe-left:\s*env\(safe-area-inset-left, 0px\)/);
    expect(stylesCss).toMatch(/min-height:\s*100dvh/);
    expect(stylesCss).toMatch(/overflow-x:\s*clip/);
    expect(stylesCss).toMatch(/address|textarea|select|input/);
    expect(uiCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(lessonsCss).toMatch(
      /grid-template-columns:\s*minmax\(240px, 300px\)\s+minmax\(0, 1fr\)/,
    );
    expect(lessonsCss).toMatch(
      /grid-template-areas:\s*"header header"\s*"sidebar main"/,
    );
    expect(writingCss).toMatch(
      /width:\s*min\(100%, 560px, max\(240px, calc\(100dvh - 280px\)\)\)/,
    );
    expect(writingCss.match(/touch-action:\s*none/g)).toHaveLength(1);
  });
});
