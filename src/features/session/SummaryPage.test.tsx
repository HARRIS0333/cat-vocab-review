import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { createProgressStore } from "../../progress/progress-store";
import {
  createSessionSummary,
  saveSessionSummary,
} from "./session-summary";
import { takeRetryQueue } from "./retry-queue";
import { SummaryPage } from "./SummaryPage";

const group = { id: "lesson-1", title: "1 观潮" };
const store = createProgressStore(
  { getItem: () => null, setItem() {}, removeItem() {} },
  "v1",
);

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "#/lesson/lesson-1/summary?mode=read";
});

it("shows success, review, error characters, and a retry action", async () => {
  saveSessionSummary(
    createSessionSummary("lesson-1", "read", [
      { id: "a", char: "浩", pinyin: "hào", result: "correct", hadError: false },
      { id: "b", char: "崩", pinyin: "bēng", result: "review", hadError: true },
    ]),
  );
  render(
    <SummaryPage
      group={group}
      groupId="lesson-1"
      mode="read"
      store={store}
    />,
  );

  const success = screen.getByLabelText("本次正确");
  const review = screen.getByLabelText("本次待复习");
  expect(within(success).getByText("1")).toBeInTheDocument();
  expect(within(review).getByText("1")).toBeInTheDocument();
  expect(screen.getByText("崩")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "小桃猫在庆祝" })).toBeInTheDocument();

  const retry = screen.getByRole("link", { name: "再练待复习字" });
  expect(retry).toHaveAttribute(
    "href",
    "#/lesson/lesson-1/read?retry=1",
  );
  await userEvent.click(retry);
  expect(takeRetryQueue("lesson-1", "read")).toEqual(["b"]);
});

it("shows a recoverable state when no summary exists", () => {
  render(
    <SummaryPage
      group={group}
      groupId="missing"
      mode="read"
      store={store}
    />,
  );
  expect(screen.getByText("没有找到本次练习结果")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute(
    "href",
    "#/",
  );
});

it("hides the retry action when every item was answered correctly", () => {
  saveSessionSummary(
    createSessionSummary("lesson-1", "read", [
      { id: "a", char: "浩", pinyin: "hào", result: "correct", hadError: false },
      { id: "b", char: "崩", pinyin: "bēng", result: "correct", hadError: false },
    ]),
  );
  render(
    <SummaryPage
      group={group}
      groupId="lesson-1"
      mode="read"
      store={store}
    />,
  );

  expect(screen.getByText("这次全部掌握啦！")).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "再练待复习字" }),
  ).not.toBeInTheDocument();
});

it("only queues review items when corrected items are also in the error history", async () => {
  saveSessionSummary(
    createSessionSummary("lesson-1", "write", [
      { id: "corrected", char: "浩", pinyin: "hào", result: "correct", hadError: true },
      { id: "review", char: "崩", pinyin: "bēng", result: "review", hadError: true },
    ]),
  );
  render(
    <SummaryPage
      group={group}
      groupId="lesson-1"
      mode="write"
      store={store}
    />,
  );

  expect(screen.getByText("浩")).toBeInTheDocument();
  expect(screen.getByText("崩")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "再练待复习字" }));
  expect(takeRetryQueue("lesson-1", "write")).toEqual(["review"]);
});
