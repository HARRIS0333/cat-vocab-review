import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createProgressStore } from "../../progress/progress-store";
import { ProgressProvider } from "../../progress/ProgressProvider";
import { makeContentFixture } from "../../test/fixtures";
import { HomePage } from "./HomePage";

function memoryStorage(initial?: string) {
  let value = initial ?? null;
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

function renderHome(store: ReturnType<typeof createProgressStore>, content = makeContentFixture()) {
  return render(
    <ProgressProvider store={store}>
      <HomePage content={content} />
    </ProgressProvider>,
  );
}

describe("HomePage progress", () => {
  it("offers a first lesson and the current progress overview without recent activity", () => {
    const content = makeContentFixture();
    const store = createProgressStore(memoryStorage(), content.contentVersion);

    renderHome(store, content);

    expect(
      screen.getByRole("heading", { name: "继续最近练习" }),
    ).toBeInTheDocument();
    expect(screen.getByText("从一课开始吧")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /继续.*练习/ })).not.toBeInTheDocument();
    expect(screen.getByText("已掌握 0")).toBeInTheDocument();
    expect(screen.getByText("待复习 0")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "课目列表" })).toBeInTheDocument();
  });

  it("links to the most recent existing group and mode with current counts", () => {
    const content = makeContentFixture();
    const store = createProgressStore(memoryStorage(), content.contentVersion);
    store.recordRecognition("lesson-2:昧:mèi", "known");
    store.recordRecognition("lesson-1:薄:bó", "review");
    store.setRecent("lesson-2", "write");

    renderHome(store, content);

    const recentLink = screen.getByRole("link", {
      name: /继续 2 繁星.*书写/,
    });
    expect(recentLink).toHaveAttribute("href", "#/lesson/lesson-2/write");
    expect(recentLink).toHaveClass("lesson-link");
    expect(screen.getByText("已掌握 1")).toBeInTheDocument();
    expect(screen.getByText("待复习 1")).toBeInTheDocument();
    expect(screen.queryByText("从一课开始吧")).not.toBeInTheDocument();
  });

  it("falls back when the recent group no longer exists", () => {
    const content = makeContentFixture();
    const store = createProgressStore(memoryStorage(), content.contentVersion);
    store.setRecent("removed-group", "read");

    renderHome(store, content);

    expect(screen.getByText("从一课开始吧")).toBeInTheDocument();
  });

  it("shows a non-blocking warning after progress cannot be persisted", () => {
    const content = makeContentFixture();
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const store = createProgressStore(storage, content.contentVersion);

    act(() => {
      store.recordRecognition("lesson-2:昧:mèi", "known");
    });
    renderHome(store, content);

    expect(screen.getByRole("status")).toHaveTextContent(
      "无法写入本地进度，刷新后本次进度可能丢失",
    );
  });
});
