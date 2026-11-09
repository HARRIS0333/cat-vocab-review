import { describe, expect, it, vi } from "vitest";
import { makeContentFixture } from "../test/fixtures";
import {
  createProgressStore,
  getProgressOverview,
  type ProgressSnapshot,
  type StoredState,
} from "./progress-store";

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

function stored(storage: ReturnType<typeof memoryStorage>): StoredState {
  const write = storage.setItem.mock.calls.at(-1);
  if (!write?.[1]) throw new Error("expected a stored state");
  return JSON.parse(write[1]) as StoredState;
}

describe("progress store", () => {
  it("records recognition and writing while preserving wrong history", () => {
    const store = createProgressStore(
      memoryStorage(),
      "v1",
      () => new Date("2026-11-06T10:00:00Z"),
    );

    store.recordRecognition("lesson-1:浩:hào", "review");
    store.recordWriting("lesson-1:浩:hào", "wrong");
    store.recordWriting("lesson-1:浩:hào", "correct");

    const item = store.getSnapshot().state.items["lesson-1:浩:hào"];
    expect(item?.recognition).toEqual({
      status: "review",
      attempts: 1,
      lastPracticedAt: "2026-11-06T10:00:00.000Z",
    });
    expect(item?.writing).toEqual({
      status: "correct",
      attempts: 2,
      wrongAttempts: 1,
      lastPracticedAt: "2026-11-06T10:00:00.000Z",
    });
    expect(JSON.stringify(store.getSnapshot())).not.toContain("points");
  });

  it("counts skipped and wrong writing as wrong attempts", () => {
    const store = createProgressStore(memoryStorage(), "v1");

    store.recordWriting("lesson-1:据:jù", "skipped");
    store.recordWriting("lesson-1:据:jù", "wrong");

    expect(store.getSnapshot().state.items["lesson-1:据:jù"]?.writing).toMatchObject({
      status: "wrong",
      attempts: 2,
      wrongAttempts: 2,
    });
  });

  it("persists only the agreed summary schema under the versioned key", () => {
    const storage = memoryStorage();
    const store = createProgressStore(storage, "v1");

    store.recordRecognition("lesson-1:浩:hào", "known");
    store.recordWriting("lesson-1:浩:hào", "correct");
    store.setRecent("lesson-1", "write");
    store.setDefaultWritingSource("both");

    expect(storage.setItem).toHaveBeenLastCalledWith(
      "cat-vocab-progress-v1",
      expect.any(String),
    );
    const state = stored(storage);
    expect(Object.keys(state).sort()).toEqual(
      ["contentVersion", "items", "recent", "schemaVersion", "settings"].sort(),
    );
    expect(state.recent).toMatchObject({ groupId: "lesson-1", mode: "write" });
    expect(state.settings.defaultWritingSource).toBe("both");
    expect(state.items["lesson-1:浩:hào"]).toEqual({
      recognition: {
        status: "known",
        attempts: 1,
        lastPracticedAt: expect.any(String),
      },
      writing: {
        status: "correct",
        attempts: 1,
        wrongAttempts: 0,
        lastPracticedAt: expect.any(String),
      },
    });
    expect(JSON.stringify(state)).not.toMatch(/points|strokes|screenshot/);
  });

  it("keeps recent practice and clears everything", () => {
    const storage = memoryStorage();
    const store = createProgressStore(storage, "v1");
    store.setRecent("garden-2", "read");
    store.recordRecognition("lesson-1:浩:hào", "known");

    expect(store.getSnapshot().state.recent?.groupId).toBe("garden-2");

    store.clearAll();

    expect(store.getSnapshot().state.items).toEqual({});
    expect(store.getSnapshot().state.recent).toBeUndefined();
    expect(store.getSnapshot().state.settings.defaultWritingSource).toBe("writing");
    expect(storage.removeItem).toHaveBeenCalledWith("cat-vocab-progress-v1");
  });

  it("falls back to an empty state when stored JSON is corrupt", () => {
    const store = createProgressStore(memoryStorage("{bad"), "v1");

    expect(store.getSnapshot().state.items).toEqual({});
    expect(store.getSnapshot().warning).toBe("本地进度损坏，已从空进度继续");
  });

  it.each([
    ["wrong schema version", { schemaVersion: 2 }],
    ["missing content version", { contentVersion: undefined }],
    ["non-object items", { schemaVersion: 1, items: null }],
    [
      "invalid writing source",
      {
        schemaVersion: 1,
        items: {},
        settings: { defaultWritingSource: "screen" },
      },
    ],
    [
      "impossible writing counters",
      {
        schemaVersion: 1,
        contentVersion: "v1",
        settings: { defaultWritingSource: "writing" },
        items: {
          "lesson-1:浩:hào": {
            writing: {
              status: "wrong",
              attempts: 1,
              wrongAttempts: 2,
              lastPracticedAt: "2026-11-06T10:00:00.000Z",
            },
          },
        },
      },
    ],
  ])("recovers from an invalid stored schema: %s", (_label, override: Record<string, unknown>) => {
    const initial = JSON.stringify(Object.assign({
      schemaVersion: 1,
      contentVersion: "v1",
      settings: { defaultWritingSource: "writing" },
      items: {},
    }, override));
    const store = createProgressStore(memoryStorage(initial), "v1");

    expect(store.getSnapshot().state.items).toEqual({});
    expect(store.getSnapshot().warning).toBe("本地进度损坏，已从空进度继续");
  });

  it("sanitizes unknown fields read from storage", () => {
    const initial = JSON.stringify({
      schemaVersion: 1,
      contentVersion: "v1",
      settings: { defaultWritingSource: "writing", points: [[1, 2]] },
      items: {
        "lesson-1:浩:hào": {
          recognition: {
            status: "known",
            attempts: 2,
            lastPracticedAt: "2026-11-06T10:00:00.000Z",
            strokes: [[[1, 2]]],
          },
        },
      },
      screenshot: "data:image/png;base64,unsafe",
    });
    const store = createProgressStore(memoryStorage(initial), "v1");

    expect(JSON.stringify(store.getSnapshot().state)).not.toMatch(
      /points|strokes|screenshot/,
    );
    expect(store.getSnapshot().state.items["lesson-1:浩:hào"]?.recognition?.status).toBe(
      "known",
    );
  });

  it("updates contentVersion without deleting matching item progress", () => {
    const storage = memoryStorage();
    const store = createProgressStore(storage, "v1");
    store.recordRecognition("lesson-1:浩:hào", "known");
    const persisted = JSON.stringify(store.getSnapshot().state);
    const next = createProgressStore(
      {
        getItem: () => persisted,
        setItem() {},
        removeItem() {},
      },
      "v2",
    );

    expect(next.getSnapshot().state.contentVersion).toBe("v2");
    expect(next.getSnapshot().state.items["lesson-1:浩:hào"]?.recognition?.status).toBe(
      "known",
    );
  });

  it("exposes each updated item and settings snapshot before persistence", () => {
    const storage = memoryStorage();
    const observed: ProgressSnapshot[] = [];
    let store: ReturnType<typeof createProgressStore>;
    storage.setItem.mockImplementation(() => {
      observed.push(store.getSnapshot());
    });
    store = createProgressStore(storage, "v1");

    store.recordRecognition("lesson-1:浩:hào", "known");
    store.recordWriting("lesson-1:浩:hào", "correct");
    store.setRecent("lesson-1", "write");
    store.setDefaultWritingSource("both");

    expect(
      observed[0]?.state.items["lesson-1:浩:hào"]?.recognition?.status,
    ).toBe("known");
    expect(
      observed[1]?.state.items["lesson-1:浩:hào"]?.writing?.status,
    ).toBe("correct");
    expect(observed[2]?.state.recent?.groupId).toBe("lesson-1");
    expect(observed[3]?.state.settings.defaultWritingSource).toBe("both");
  });

  it("exposes cleared state before attempting to remove storage", () => {
    const storage = memoryStorage();
    const store = createProgressStore(storage, "v1");
    store.recordRecognition("lesson-1:浩:hào", "known");
    store.setRecent("lesson-1", "read");
    let observed: ProgressSnapshot | undefined;
    storage.removeItem.mockImplementation(() => {
      observed = store.getSnapshot();
    });

    store.clearAll();

    expect(observed?.state.items).toEqual({});
    expect(observed?.state.recent).toBeUndefined();
  });

  it("continues in memory when writing to storage fails", () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const store = createProgressStore(storage, "v1");

    store.recordRecognition("lesson-1:浩:hào", "known");

    expect(store.getSnapshot().warning).toBe(
      "无法写入本地进度，刷新后本次进度可能丢失",
    );
    expect(store.getSnapshot().state.items["lesson-1:浩:hào"]?.recognition?.status).toBe(
      "known",
    );
  });

  it("notifies subscribers after an in-memory update", () => {
    const store = createProgressStore(memoryStorage(), "v1");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.recordWriting("lesson-1:据:jù", "correct");
    unsubscribe();
    store.recordWriting("lesson-1:据:jù", "correct");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("getProgressOverview", () => {
  it("counts current items once, lets review win, and ignores stale IDs", () => {
    const content = makeContentFixture();
    const store = createProgressStore(memoryStorage(), content.contentVersion);

    store.recordRecognition("lesson-1:盐:yán", "known");
    store.recordRecognition("lesson-1:薄:bó", "review");
    store.recordWriting("lesson-1:薄:bó", "correct");
    store.recordRecognition("lesson-1:隆:lóng", "known");
    store.recordWriting("lesson-1:隆:lóng", "wrong");
    store.recordWriting("lesson-1:据:jù", "correct");
    store.recordWriting("lesson-1:随:suí", "wrong");
    store.recordWriting("lesson-1:堤:dī", "wrong");
    store.recordWriting("lesson-1:堤:dī", "correct");
    store.recordRecognition("lesson-1:旧:jiù", "known");

    expect(getProgressOverview(content.groups, store.getSnapshot().state)).toEqual({
      mastered: 3,
      review: 3,
    });
  });
});
