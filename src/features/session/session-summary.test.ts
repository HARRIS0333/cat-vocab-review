import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createSessionSummary,
  loadSessionSummary,
  saveSessionSummary,
} from "./session-summary";

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("derives success, review and error counts without raw strokes", () => {
  const summary = createSessionSummary("lesson-1", "write", [
    { id: "a", char: "浩", pinyin: "hào", result: "correct", hadError: true },
    { id: "b", char: "崩", pinyin: "bēng", result: "correct", hadError: false },
    { id: "c", char: "霎", pinyin: "shà", result: "review", hadError: true },
  ]);
  expect(summary.successCount).toBe(2);
  expect(summary.reviewCount).toBe(1);
  expect(summary.errorItems.map((item) => item.char)).toEqual(["浩", "霎"]);
  expect(JSON.stringify(summary)).not.toContain("points");
});

it("round-trips a sanitized summary per group and mode", () => {
  const summary = createSessionSummary("lesson-1", "read", [
    { id: "a", char: "浩", pinyin: "hào", result: "review", hadError: false },
  ]);
  saveSessionSummary(summary);

  expect(loadSessionSummary("lesson-1", "read")).toMatchObject({
    groupId: "lesson-1",
    mode: "read",
    successCount: 0,
    reviewCount: 1,
  });
  expect(loadSessionSummary("lesson-1", "write")).toBeUndefined();
});

it("strips unknown fields before serializing", () => {
  const summary = createSessionSummary("lesson-1", "write", [
    {
      id: "a",
      char: "浩",
      pinyin: "hào",
      result: "correct",
      hadError: false,
      points: [{ x: 1, y: 2 }],
      screenshot: "data:image/png;base64,unsafe",
    } as never,
  ]);
  saveSessionSummary(summary);

  const serialized = sessionStorage.getItem("cat-vocab-session-summary-v1");
  expect(serialized).not.toContain("points");
  expect(serialized).not.toContain("screenshot");
  expect(serialized).not.toContain("data:image");
});

it("keeps a memory mirror when storage reads fail and recovers later", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read blocked");
  });
  const summary = createSessionSummary("read-failure", "read", [
    { id: "a", char: "浩", pinyin: "hào", result: "review", hadError: true },
  ]);

  saveSessionSummary(summary);
  expect(loadSessionSummary("read-failure", "read")).toMatchObject({
    reviewCount: 1,
  });

  vi.mocked(Storage.prototype.getItem).mockRestore();
  expect(loadSessionSummary("read-failure", "read")).toMatchObject({
    reviewCount: 1,
  });
});

it("does not overwrite unknown storage after a read failure", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read blocked");
  });
  const setItem = vi.spyOn(Storage.prototype, "setItem");

  saveSessionSummary(
    createSessionSummary("unreadable-storage", "read", [
      { id: "a", char: "浩", pinyin: "hào", result: "review", hadError: true },
    ]),
  );

  expect(setItem).not.toHaveBeenCalled();
  expect(loadSessionSummary("unreadable-storage", "read")).toBeDefined();
});

it("repairs earlier memory-only summaries after storage recovery", () => {
  const read = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementationOnce(() => {
      throw new Error("read blocked");
    });

  saveSessionSummary(
    createSessionSummary("recover-a", "read", [
      { id: "a", char: "浩", pinyin: "hào", result: "review", hadError: true },
    ]),
  );
  read.mockRestore();
  saveSessionSummary(
    createSessionSummary("recover-b", "write", [
      { id: "b", char: "据", pinyin: "jù", result: "correct", hadError: false },
    ]),
  );

  const serialized = sessionStorage.getItem("cat-vocab-session-summary-v1") ?? "";
  expect(serialized).toContain("recover-a:read");
  expect(serialized).toContain("recover-b:write");
});
