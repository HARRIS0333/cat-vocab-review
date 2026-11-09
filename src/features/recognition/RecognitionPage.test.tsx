import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContentGroup } from "../../content/types";
import { createProgressStore } from "../../progress/progress-store";
import { saveRetryQueue } from "../session/retry-queue";
import { RecognitionPage } from "./RecognitionPage";

const group: ContentGroup = {
  id: "lesson-1",
  kind: "lesson",
  unit: "第一单元",
  title: "1 观潮",
  lessonNo: 1,
  sourcePage: 7,
  reading: [
    { id: "lesson-1:浩:hào", char: "浩", pinyin: "hào", polyphone: false },
    { id: "lesson-1:薄:bó", char: "薄", pinyin: "bó", polyphone: true, speechText: "薄雾" },
  ],
  writing: [
    { id: "lesson-1:据:jù", char: "据", pinyin: "jù", polyphone: false },
  ],
};

function makeStore() {
  return createProgressStore(
    { getItem: () => null, setItem() {}, removeItem() {} },
    "v1",
  );
}

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "#/lesson/lesson-1/read";
});
afterEach(() => vi.restoreAllMocks());

it("hides pinyin until the card is pressed, speaks once, and leaves writing items alone", async () => {
  const speechService = {
    speak: vi.fn().mockResolvedValue("spoken"),
    cancel: vi.fn(),
  };
  render(
    <RecognitionPage
      group={group}
      retry={false}
      store={makeStore()}
      speechService={speechService}
    />,
  );

  expect(screen.queryByText("hào")).not.toBeInTheDocument();
  expect(screen.queryByText("据")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "显示“浩”的拼音和读音" }),
  );

  expect(screen.getByText("hào")).toBeInTheDocument();
  expect(speechService.speak).toHaveBeenCalledTimes(1);
  expect(speechService.speak).toHaveBeenCalledWith("浩");
  expect(screen.getByRole("button", { name: "还不熟" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "认识" })).toBeEnabled();
});

it("keeps automatic speech alive in StrictMode and only replays from the speaker button", async () => {
  const speechService = {
    speak: vi.fn().mockResolvedValue("spoken"),
    cancel: vi.fn(),
  };
  render(
    <StrictMode>
      <RecognitionPage
        group={group}
        retry={false}
        store={makeStore()}
        speechService={speechService}
      />
    </StrictMode>,
  );

  const card = screen.getByRole("button", { name: /显示“浩”/ });
  await userEvent.click(card);
  expect(speechService.speak).toHaveBeenCalledTimes(1);
  expect(speechService.cancel).not.toHaveBeenCalled();

  await userEvent.click(card);
  expect(speechService.speak).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  expect(speechService.speak).toHaveBeenCalledTimes(2);
});

it("shows a visible retry when automatic speech fails", async () => {
  const speechService = {
    speak: vi
      .fn()
      .mockResolvedValueOnce("unavailable")
      .mockResolvedValueOnce("spoken"),
    cancel: vi.fn(),
  };
  render(
    <RecognitionPage
      group={group}
      retry={false}
      store={makeStore()}
      speechService={speechService}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /显示“浩”/ }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "此设备暂时无法播放读音",
  );
  await userEvent.click(screen.getByRole("button", { name: "再试一次" }));

  expect(speechService.speak).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("keeps a successful manual replay when automatic speech finishes with an error", async () => {
  let resolveAuto: ((result: "error") => void) | undefined;
  let resolveManual: ((result: "spoken" | "error") => void) | undefined;
  const speechService = {
    speak: vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<"error">((resolve) => {
          resolveAuto = resolve;
        }),
      )
      .mockImplementationOnce(() => {
        resolveAuto?.("error");
        return new Promise<"spoken" | "error">((resolve) => {
          resolveManual = resolve;
        });
      }),
    cancel: vi.fn(),
  };
  render(
    <RecognitionPage
      group={group}
      retry={false}
      store={makeStore()}
      speechService={speechService}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /显示“浩”/ }));
  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  expect(screen.getByRole("button", { name: "正在播放…" })).toBeDisabled();

  await act(async () => {
    resolveAuto?.("error");
    await Promise.resolve();
  });
  expect(speechService.cancel).not.toHaveBeenCalled();

  await act(async () => resolveManual?.("spoken"));

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "播放读音" })).toBeEnabled();
});

it("records answers, updates recent practice, and navigates to a saved summary", async () => {
  const store = makeStore();
  const recognitionSpy = vi.spyOn(store, "recordRecognition");
  const recentSpy = vi.spyOn(store, "setRecent");
  const speechService = {
    speak: vi.fn().mockResolvedValue("spoken"),
    cancel: vi.fn(),
  };
  render(
    <RecognitionPage
      group={group}
      retry={false}
      store={store}
      speechService={speechService}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /显示“浩”/ }));
  await userEvent.click(screen.getByRole("button", { name: "认识" }));
  expect(recognitionSpy).toHaveBeenLastCalledWith("lesson-1:浩:hào", "known");
  expect(recentSpy).toHaveBeenLastCalledWith("lesson-1", "read");

  await userEvent.click(screen.getByRole("button", { name: /显示“薄”/ }));
  await userEvent.click(screen.getByRole("button", { name: "还不熟" }));

  await waitFor(() =>
    expect(window.location.hash).toBe("#/lesson/lesson-1/summary?mode=read"),
  );
  const saved = sessionStorage.getItem("cat-vocab-session-summary-v1");
  expect(saved).toContain("lesson-1:薄:bó");
  expect(saved).not.toContain("point");
});

it("uses the consumed retry queue and falls back to the full reading list", async () => {
  saveRetryQueue("lesson-1", "read", ["lesson-1:薄:bó"]);
  const speechService = {
    speak: vi.fn().mockResolvedValue("spoken"),
    cancel: vi.fn(),
  };
  const { unmount } = render(
    <RecognitionPage
      group={group}
      retry
      store={makeStore()}
      speechService={speechService}
    />,
  );

  expect(
    screen.getByRole("button", { name: "显示“薄”的拼音和读音" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "显示“浩”的拼音和读音" }),
  ).not.toBeInTheDocument();
  unmount();

  render(
    <RecognitionPage
      group={group}
      retry
      store={makeStore()}
      speechService={speechService}
    />,
  );
  expect(
    screen.getByRole("button", { name: "显示“浩”的拼音和读音" }),
  ).toBeInTheDocument();
});

it("renders a recoverable empty state", () => {
  render(
    <RecognitionPage
      group={{ ...group, reading: [] }}
      retry={false}
      store={makeStore()}
    />,
  );
  expect(screen.getByText("本课暂时没有认读内容")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute(
    "href",
    "#/",
  );
});
