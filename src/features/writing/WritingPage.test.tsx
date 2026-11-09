import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ContentGroup } from "../../content/types";
import type { CharacterFileData, InputStroke } from "../../handwriting/types";
import {
  createProgressStore,
  type ProgressStore,
} from "../../progress/progress-store";
import { loadSessionSummary } from "../session/session-summary";
import { saveRetryQueue } from "../session/retry-queue";
import { WritingPage } from "./WritingPage";

vi.mock("./WritingBoard", () => ({
  WritingBoard: ({ onSubmit }: { onSubmit: (strokes: InputStroke[]) => void }) => (
    <button onClick={() => onSubmit([
      { id: "s1", points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.2 }] },
    ])}>提交测试笔迹</button>
  ),
}));

vi.mock("../../ui/StrokePlayer", () => ({
  StrokePlayer: () => <div data-testid="stroke-player" />,
}));

const group: ContentGroup = {
  id: "lesson-11",
  kind: "lesson",
  unit: "第四单元",
  title: "11 盘古开天地",
  lessonNo: 11,
  sourcePage: 42,
  reading: [],
  writing: [
    { id: "lesson-11:丈:zhàng", char: "丈", pinyin: "zhàng", polyphone: false },
  ],
};
const data: CharacterFileData = {
  strokes: ["M 100 500 L 900 500"],
  medians: [[{ x: 100, y: 500 }, { x: 900, y: 500 }]],
};

function createTestStore(): ProgressStore {
  return createProgressStore(
    { getItem: () => null, setItem() {}, removeItem() {} },
    "v1",
  );
}

let store: ProgressStore;

beforeEach(() => {
  sessionStorage.clear();
  store = createTestStore();
  window.location.hash = "#/lesson/lesson-11/write";
});

it("shows pinyin but not the answer and records a correct response", async () => {
  const loadCharacterData = vi.fn().mockResolvedValue(data);
  const evaluate = vi.fn().mockReturnValue({
    verdict: "correct" as const,
    reasons: [],
    confidence: 1,
    strokeMatches: [],
  });
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={loadCharacterData}
      evaluate={evaluate}
    />,
  );
  expect(screen.getByText("zhàng")).toBeInTheDocument();
  expect(screen.queryByText("丈")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "提交测试笔迹" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "提交测试笔迹" }));
  expect(await screen.findByText("写对了！")).toBeInTheDocument();
  expect(store.getSnapshot().state.items[group.writing[0]!.id]?.writing?.status).toBe("correct");
  await userEvent.click(screen.getByRole("button", { name: "下一字" }));
  expect(window.location.hash).toContain("/summary?mode=write");
  const persisted = `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`;
  expect(persisted).not.toContain("points");
  expect(persisted).not.toContain("strokes");
  expect(persisted).not.toContain("screenshot");
});

it("records an incorrect attempt, then records skip and finishes", async () => {
  const loadCharacterData = vi.fn().mockResolvedValue(data);
  const evaluate = vi.fn().mockReturnValue({
    verdict: "incorrect" as const,
    reasons: ["stroke_order"],
    confidence: 0.4,
    strokeMatches: [],
  });
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={loadCharacterData}
      evaluate={evaluate}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "提交测试笔迹" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "提交测试笔迹" }));
  expect(await screen.findByText("笔画顺序不对")).toBeInTheDocument();
  expect(store.getSnapshot().state.items[group.writing[0]!.id]?.writing?.wrongAttempts).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "先跳过" }));
  expect(store.getSnapshot().state.items[group.writing[0]!.id]?.writing?.status).toBe("skipped");
  expect(window.location.hash).toContain("/summary?mode=write");
});

it("submits once when the board reports twice in the same act", async () => {
  const evaluate = vi.fn().mockReturnValue({
    verdict: "incorrect" as const,
    reasons: ["stroke_order"],
    confidence: 0.4,
    strokeMatches: [],
  });
  const recordWriting = vi.spyOn(store, "recordWriting");
  const setRecent = vi.spyOn(store, "setRecent");
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={vi.fn().mockResolvedValue(data)}
      evaluate={evaluate}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "提交测试笔迹" })).toBeEnabled(),
  );
  const submit = screen.getByRole("button", { name: "提交测试笔迹" });

  act(() => {
    fireEvent.click(submit);
    fireEvent.click(submit);
  });

  expect(await screen.findByText("笔画顺序不对")).toBeInTheDocument();
  expect(evaluate).toHaveBeenCalledTimes(1);
  expect(recordWriting).toHaveBeenCalledTimes(1);
  expect(recordWriting).toHaveBeenCalledWith(group.writing[0]!.id, "wrong");
  expect(store.getSnapshot().state.items[group.writing[0]!.id]?.writing?.wrongAttempts).toBe(1);
  expect(setRecent).toHaveBeenCalledTimes(1);
});

it("reopens unclear writing without recording an error", async () => {
  const loadCharacterData = vi.fn().mockResolvedValue(data);
  const evaluate = vi.fn().mockReturnValue({
    verdict: "unclear" as const,
    reasons: ["ink_quality"],
    confidence: 0.2,
    strokeMatches: [],
  });
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={loadCharacterData}
      evaluate={evaluate}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "提交测试笔迹" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "提交测试笔迹" }));
  await userEvent.click(await screen.findByRole("button", { name: "再写一次" }));
  expect(store.getSnapshot().state.items[group.writing[0]!.id]?.writing).toBeUndefined();
  expect(screen.getByText("zhàng")).toBeInTheDocument();
});

it("skips a character when stroke data fails to load and records review", async () => {
  const loadCharacterData = vi.fn().mockRejectedValueOnce(new Error("offline"));
  const evaluate = vi.fn();
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={loadCharacterData}
      evaluate={evaluate}
    />,
  );
  expect(await screen.findByText("这个字的笔顺数据暂时无法加载")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "先跳过" }));
  await waitFor(() => expect(window.location.hash).toContain("/summary?mode=write"));
  expect(evaluate).not.toHaveBeenCalled();
  expect(store.getSnapshot().state.items[group.writing[0]!.id]?.writing?.status).toBe("skipped");
  expect(loadSessionSummary(group.id, "write")?.reviewCount).toBe(1);
});

it("uses the saved writing source and remembers a source switch", async () => {
  const mixedGroup: ContentGroup = {
    ...group,
    id: "lesson-mixed",
    reading: [
      { id: "lesson-mixed:潮:cháo", char: "潮", pinyin: "cháo", polyphone: false },
    ],
    writing: [
      group.writing[0]!,
      { id: "lesson-mixed:堤:dī", char: "堤", pinyin: "dī", polyphone: false },
    ],
  };
  render(
    <WritingPage
      group={mixedGroup}
      retry={false}
      store={store}
      loadCharacterData={vi.fn().mockResolvedValue(data)}
    />,
  );

  expect(screen.getByRole("button", { name: "仅写字表 · 2 字" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("zhàng")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "仅识字表 · 1 字" }));

  expect(screen.getByText("cháo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "仅识字表 · 1 字" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(store.getSnapshot().state.settings.defaultWritingSource).toBe("reading");
});

it("visibly falls back to the reading table when the saved writing table is empty", () => {
  const fallbackGroup: ContentGroup = {
    ...group,
    id: "lesson-fallback",
    reading: [
      { id: "lesson-fallback:巢:cháo", char: "巢", pinyin: "cháo", polyphone: false },
    ],
    writing: [],
  };
  render(
    <WritingPage
      group={fallbackGroup}
      retry={false}
      store={store}
      loadCharacterData={vi.fn().mockResolvedValue(data)}
    />,
  );

  expect(screen.getByRole("button", { name: "仅识字表 · 1 字" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByText("本课没有写字表内容，已切换到仅识字表"),
  ).toBeInTheDocument();
  expect(screen.getByText("cháo")).toBeInTheDocument();
});

it("keeps the queued retry item when StrictMode replays state initialization", async () => {
  const retryGroup: ContentGroup = {
    ...group,
    id: "lesson-retry",
    writing: [
      group.writing[0]!,
      { id: "lesson-retry:墙:qiáng", char: "墙", pinyin: "qiáng", polyphone: false },
    ],
  };
  store.setDefaultWritingSource("reading");
  saveRetryQueue(retryGroup.id, "write", [retryGroup.writing[1]!.id]);

  render(
    <StrictMode>
      <WritingPage
        group={retryGroup}
        retry
        store={store}
        loadCharacterData={vi.fn().mockResolvedValue(data)}
      />
    </StrictMode>,
  );

  expect(screen.getByText("qiáng")).toBeInTheDocument();
  expect(screen.getByText("第 1 / 1 题")).toBeInTheDocument();
  expect(screen.queryByText("zhàng")).not.toBeInTheDocument();
  expect(store.getSnapshot().state.settings.defaultWritingSource).toBe("reading");
});

it("recovers after retrying a failed character-data load", async () => {
  const loadCharacterData = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(data);
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={loadCharacterData}
    />,
  );

  expect(
    await screen.findByText("这个字的笔顺数据暂时无法加载"),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "重新加载" }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "提交测试笔迹" })).toBeEnabled(),
  );
  expect(loadCharacterData).toHaveBeenCalledTimes(2);
});

it("automatically advances 800ms after a correct answer", async () => {
  render(
    <WritingPage
      group={group}
      retry={false}
      store={store}
      loadCharacterData={vi.fn().mockResolvedValue(data)}
      evaluate={vi.fn().mockReturnValue({
        verdict: "correct" as const,
        reasons: [],
        confidence: 1,
        strokeMatches: [],
      })}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "提交测试笔迹" })).toBeEnabled(),
  );

  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole("button", { name: "提交测试笔迹" }));
    expect(screen.getByText("写对了！")).toBeInTheDocument();
    expect(window.location.hash).not.toContain("/summary");

    act(() => vi.advanceTimersByTime(800));

    expect(window.location.hash).toContain("/summary?mode=write");
  } finally {
    vi.useRealTimers();
  }
});
