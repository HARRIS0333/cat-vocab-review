import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveRetryQueue, takeRetryQueue } from "./retry-queue";

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("stores and consumes a retry queue once", () => {
  saveRetryQueue("queue-once", "read", ["queue-once:浩:hào"]);
  expect(takeRetryQueue("queue-once", "read")).toEqual(["queue-once:浩:hào"]);
  expect(takeRetryQueue("queue-once", "read")).toEqual([]);
});

it("falls back to memory when sessionStorage writes throw", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  saveRetryQueue("queue-blocked", "write", ["queue-blocked:据:jù"]);
  expect(takeRetryQueue("queue-blocked", "write")).toEqual([
    "queue-blocked:据:jù",
  ]);
  expect(takeRetryQueue("queue-blocked", "write")).toEqual([]);
});

it("falls back to memory when sessionStorage reads throw and consumes only once", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read blocked");
  });
  saveRetryQueue("queue-read-blocked", "read", ["a", "b"]);

  expect(takeRetryQueue("queue-read-blocked", "read")).toEqual(["a", "b"]);
  expect(takeRetryQueue("queue-read-blocked", "read")).toEqual([]);
});

it("keeps a consumed tombstone after a write failure", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("write blocked");
  });
  saveRetryQueue("queue-write-blocked", "write", ["a"]);

  expect(takeRetryQueue("queue-write-blocked", "write")).toEqual(["a"]);
  expect(takeRetryQueue("queue-write-blocked", "write")).toEqual([]);
});

it("repairs earlier memory-only queues after storage recovery", () => {
  const read = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementationOnce(() => {
      throw new Error("read blocked");
    });
  saveRetryQueue("queue-recover-a", "read", ["a"]);
  read.mockRestore();
  saveRetryQueue("queue-recover-b", "write", ["b"]);

  const serialized = sessionStorage.getItem("cat-vocab-retry-queue-v1") ?? "";
  expect(serialized).toContain("queue-recover-a:read");
  expect(serialized).toContain("queue-recover-b:write");
});

it("returns a defensive copy", () => {
  saveRetryQueue("queue-copy", "read", ["a", "b"]);
  const first = takeRetryQueue("queue-copy", "read");
  first.push("c");
  expect(first).toEqual(["a", "b", "c"]);
  expect(takeRetryQueue("queue-copy", "read")).toEqual([]);
});
