import type { PracticeMode } from "../../app/hash-router";

export const RETRY_QUEUE_STORAGE_KEY = "cat-vocab-retry-queue-v1";

type RetryRecord = Record<string, string[]>;

type RetryReadResult =
  | { ok: true; record: RetryRecord }
  | { ok: false };

const fallbackQueues = new Map<string, string[]>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queueKey(groupId: string, mode: PracticeMode): string {
  return `${groupId}:${mode}`;
}

function getSessionStorage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function sanitizeIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return [...value];
}

function readStorageRecord(): RetryReadResult {
  const storage = getSessionStorage();
  if (!storage) return { ok: false };

  try {
    const raw = storage.getItem(RETRY_QUEUE_STORAGE_KEY);
    if (!raw) return { ok: true, record: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ok: false };

    const record: RetryRecord = {};
    for (const [key, value] of Object.entries(parsed)) {
      const ids = sanitizeIds(value);
      if (ids) record[key] = ids;
    }
    return { ok: true, record };
  } catch {
    return { ok: false };
  }
}

function mergeFallbackQueues(record: RetryRecord): void {
  for (const [key, ids] of fallbackQueues) {
    if (ids.length === 0) delete record[key];
    else record[key] = [...ids];
  }
}

function writeRecord(record: RetryRecord): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  try {
    storage.setItem(RETRY_QUEUE_STORAGE_KEY, JSON.stringify(record));
    fallbackQueues.clear();
    return true;
  } catch {
    return false;
  }
}

export function saveRetryQueue(
  groupId: string,
  mode: PracticeMode,
  itemIds: readonly string[],
): void {
  const key = queueKey(groupId, mode);
  const ids = [...itemIds];
  const read = readStorageRecord();
  if (!read.ok) {
    fallbackQueues.set(key, ids);
    return;
  }

  const record = read.record;
  mergeFallbackQueues(record);
  record[key] = ids;

  if (!writeRecord(record)) fallbackQueues.set(key, ids);
}

export function takeRetryQueue(
  groupId: string,
  mode: PracticeMode,
): string[] {
  const key = queueKey(groupId, mode);
  const read = readStorageRecord();
  if (!read.ok) {
    const fallback = fallbackQueues.get(key);
    if (!fallback) return [];

    fallbackQueues.set(key, []);
    return [...fallback];
  }

  const record = read.record;
  mergeFallbackQueues(record);
  const ids = record[key];
  if (!ids) return [];

  const result = [...ids];
  delete record[key];
  if (!writeRecord(record)) fallbackQueues.set(key, []);
  return result;
}
