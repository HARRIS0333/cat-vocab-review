import type { ContentGroup, WritingSource } from "../content/types";

export const PROGRESS_STORAGE_KEY = "cat-vocab-progress-v1";

const CORRUPT_WARNING = "本地进度损坏，已从空进度继续";
const READ_WARNING = "无法读取本地进度，已从空进度继续";
const WRITE_WARNING = "无法写入本地进度，刷新后本次进度可能丢失";
const CLEAR_WARNING = "无法清除本地进度，刷新后可能恢复";

type RecognitionStatus = "known" | "review";
type WritingStatus = "correct" | "wrong" | "skipped";
type PracticeMode = "read" | "write";

export type StoredState = {
  schemaVersion: 1;
  contentVersion: string;
  settings: {
    defaultWritingSource: WritingSource;
  };
  items: Record<
    string,
    {
      recognition?: {
        status: RecognitionStatus;
        attempts: number;
        lastPracticedAt: string;
      };
      writing?: {
        status: WritingStatus;
        attempts: number;
        wrongAttempts: number;
        lastPracticedAt: string;
      };
    }
  >;
  recent?: {
    groupId: string;
    mode: PracticeMode;
    updatedAt: string;
  };
};

export type ProgressSnapshot = {
  state: StoredState;
  warning?: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ProgressStore = {
  getSnapshot(): ProgressSnapshot;
  subscribe(listener: () => void): () => void;
  recordRecognition(itemId: string, status: RecognitionStatus): void;
  recordWriting(itemId: string, outcome: WritingStatus): void;
  setRecent(groupId: string, mode: PracticeMode): void;
  setDefaultWritingSource(source: WritingSource): void;
  clearAll(): void;
};

function emptyState(contentVersion: string): StoredState {
  return {
    schemaVersion: 1,
    contentVersion,
    settings: { defaultWritingSource: "writing" },
    items: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isWritingSource(value: unknown): value is WritingSource {
  return value === "writing" || value === "reading" || value === "both";
}

function isRecognitionStatus(value: unknown): value is RecognitionStatus {
  return value === "known" || value === "review";
}

function isWritingStatus(value: unknown): value is WritingStatus {
  return value === "correct" || value === "wrong" || value === "skipped";
}

function parseState(raw: string, contentVersion: string): StoredState | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(value) || value.schemaVersion !== 1) return undefined;
  if (typeof value.contentVersion !== "string" || !value.contentVersion.trim()) {
    return undefined;
  }
  if (!isRecord(value.items) || !isRecord(value.settings)) return undefined;
  if (!isWritingSource(value.settings.defaultWritingSource)) return undefined;

  const items: StoredState["items"] = {};
  for (const [itemId, rawItem] of Object.entries(value.items)) {
    if (!isRecord(rawItem)) return undefined;

    const item: StoredState["items"][string] = {};
    if (rawItem.recognition !== undefined) {
      const recognition = rawItem.recognition;
      if (
        !isRecord(recognition) ||
        !isRecognitionStatus(recognition.status) ||
        !isCount(recognition.attempts) ||
        typeof recognition.lastPracticedAt !== "string"
      ) {
        return undefined;
      }
      item.recognition = {
        status: recognition.status,
        attempts: recognition.attempts,
        lastPracticedAt: recognition.lastPracticedAt,
      };
    }

    if (rawItem.writing !== undefined) {
      const writing = rawItem.writing;
      if (
        !isRecord(writing) ||
        !isWritingStatus(writing.status) ||
        !isCount(writing.attempts) ||
        !isCount(writing.wrongAttempts) ||
        writing.wrongAttempts > writing.attempts ||
        typeof writing.lastPracticedAt !== "string"
      ) {
        return undefined;
      }
      item.writing = {
        status: writing.status,
        attempts: writing.attempts,
        wrongAttempts: writing.wrongAttempts,
        lastPracticedAt: writing.lastPracticedAt,
      };
    }

    items[itemId] = item;
  }

  let recent: StoredState["recent"];
  if (value.recent !== undefined) {
    if (
      !isRecord(value.recent) ||
      typeof value.recent.groupId !== "string" ||
      !value.recent.groupId.trim() ||
      (value.recent.mode !== "read" && value.recent.mode !== "write") ||
      typeof value.recent.updatedAt !== "string"
    ) {
      return undefined;
    }
    recent = {
      groupId: value.recent.groupId,
      mode: value.recent.mode,
      updatedAt: value.recent.updatedAt,
    };
  }

  return {
    schemaVersion: 1,
    contentVersion,
    settings: { defaultWritingSource: value.settings.defaultWritingSource },
    items,
    ...(recent ? { recent } : {}),
  };
}

export function createProgressStore(
  storage: StorageLike,
  contentVersion: string,
  now: () => Date = () => new Date(),
): ProgressStore {
  let state = emptyState(contentVersion);
  let warning: string | undefined;
  const listeners = new Set<() => void>();

  let stored: string | null = null;
  try {
    stored = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    warning = READ_WARNING;
  }

  if (stored !== null) {
    const parsed = parseState(stored, contentVersion);
    if (parsed) {
      state = parsed;
      if (parsed.contentVersion !== contentVersion) {
        state = { ...parsed, contentVersion };
      }
    } else {
      warning = CORRUPT_WARNING;
    }
  }

  let snapshot: ProgressSnapshot = { state, ...(warning ? { warning } : {}) };

  function setSnapshot(nextState: StoredState, nextWarning?: string): void {
    state = nextState;
    snapshot = { state, ...(nextWarning ? { warning: nextWarning } : {}) };
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function persist(nextState: StoredState): string | undefined {
    try {
      storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(nextState));
      return undefined;
    } catch {
      return WRITE_WARNING;
    }
  }

  function updateItem(
    itemId: string,
    createItem: (current: StoredState["items"][string] | undefined) => StoredState["items"][string],
  ): void {
    const current = state.items[itemId];
    const nextState: StoredState = {
      ...state,
      items: { ...state.items, [itemId]: createItem(current) },
    };
    setSnapshot(nextState);
    const nextWarning = persist(nextState);
    setSnapshot(nextState, nextWarning);
    notify();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    recordRecognition(itemId, status) {
      updateItem(itemId, (current) => ({
        ...current,
        recognition: {
          status,
          attempts: (current?.recognition?.attempts ?? 0) + 1,
          lastPracticedAt: now().toISOString(),
        },
      }));
    },
    recordWriting(itemId, outcome) {
      updateItem(itemId, (current) => ({
        ...current,
        writing: {
          status: outcome,
          attempts: (current?.writing?.attempts ?? 0) + 1,
          wrongAttempts:
            (current?.writing?.wrongAttempts ?? 0) +
            (outcome === "wrong" || outcome === "skipped" ? 1 : 0),
          lastPracticedAt: now().toISOString(),
        },
      }));
    },
    setRecent(groupId, mode) {
      const nextState: StoredState = {
        ...state,
        recent: { groupId, mode, updatedAt: now().toISOString() },
      };
      setSnapshot(nextState);
      const nextWarning = persist(nextState);
      setSnapshot(nextState, nextWarning);
      notify();
    },
    setDefaultWritingSource(source) {
      const nextState: StoredState = {
        ...state,
        settings: { defaultWritingSource: source },
      };
      setSnapshot(nextState);
      const nextWarning = persist(nextState);
      setSnapshot(nextState, nextWarning);
      notify();
    },
    clearAll() {
      const nextState = emptyState(contentVersion);
      setSnapshot(nextState);
      let nextWarning: string | undefined;
      try {
        storage.removeItem(PROGRESS_STORAGE_KEY);
      } catch {
        nextWarning = CLEAR_WARNING;
      }
      setSnapshot(nextState, nextWarning);
      notify();
    },
  };
}

export function getProgressOverview(
  groups: ContentGroup[],
  state: StoredState,
): { mastered: number; review: number } {
  const currentItemIds = new Set(
    groups.flatMap((group) => [
      ...group.reading.map((item) => item.id),
      ...group.writing.map((item) => item.id),
    ]),
  );

  let mastered = 0;
  let review = 0;
  for (const itemId of currentItemIds) {
    const item = state.items[itemId];
    if (!item) continue;

    const needsReview =
      item.recognition?.status === "review" ||
      item.writing?.status === "wrong" ||
      item.writing?.status === "skipped";
    if (needsReview) {
      review += 1;
      continue;
    }

    if (
      item.recognition?.status === "known" ||
      item.writing?.status === "correct"
    ) {
      mastered += 1;
    }
  }

  return { mastered, review };
}
