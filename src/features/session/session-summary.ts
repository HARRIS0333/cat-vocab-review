import type { PracticeMode } from "../../app/hash-router";

export const SESSION_SUMMARY_STORAGE_KEY = "cat-vocab-session-summary-v1";

export type SessionSummaryItem = {
  id: string;
  char: string;
  pinyin: string;
  result: "correct" | "review";
  hadError: boolean;
};

export type SessionSummary = {
  groupId: string;
  mode: PracticeMode;
  successCount: number;
  reviewCount: number;
  errorItems: SessionSummaryItem[];
};

type SummaryRecord = Record<string, SessionSummary>;

type SummaryReadResult =
  | { ok: true; record: SummaryRecord }
  | { ok: false };

const fallbackSummaries = new Map<string, SessionSummary>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMode(value: unknown): value is PracticeMode {
  return value === "read" || value === "write";
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function sanitizeItem(value: unknown): SessionSummaryItem | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.id !== "string" ||
    typeof value.char !== "string" ||
    typeof value.pinyin !== "string" ||
    (value.result !== "correct" && value.result !== "review") ||
    typeof value.hadError !== "boolean"
  ) {
    return undefined;
  }

  return {
    id: value.id,
    char: value.char,
    pinyin: value.pinyin,
    result: value.result,
    hadError: value.hadError,
  };
}

function sanitizeSummary(value: unknown): SessionSummary | undefined {
  if (!isRecord(value) || !isMode(value.mode)) return undefined;
  if (
    typeof value.groupId !== "string" ||
    !value.groupId.trim() ||
    !isCount(value.successCount) ||
    !isCount(value.reviewCount) ||
    !Array.isArray(value.errorItems)
  ) {
    return undefined;
  }

  const errorItems: SessionSummaryItem[] = [];
  for (const rawItem of value.errorItems) {
    const item = sanitizeItem(rawItem);
    if (!item) return undefined;
    errorItems.push(item);
  }

  return {
    groupId: value.groupId,
    mode: value.mode,
    successCount: value.successCount,
    reviewCount: value.reviewCount,
    errorItems,
  };
}

function summaryKey(groupId: string, mode: PracticeMode): string {
  return `${groupId}:${mode}`;
}

function getSessionStorage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function readSummaryRecord(): SummaryReadResult {
  const storage = getSessionStorage();
  if (!storage) return { ok: false };

  try {
    const raw = storage.getItem(SESSION_SUMMARY_STORAGE_KEY);
    if (!raw) return { ok: true, record: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ok: false };

    const record: SummaryRecord = {};
    for (const [key, value] of Object.entries(parsed)) {
      const summary = sanitizeSummary(value);
      if (summary) record[key] = summary;
    }
    return { ok: true, record };
  } catch {
    return { ok: false };
  }
}

function mergeFallbackSummaries(record: SummaryRecord): void {
  for (const [key, summary] of fallbackSummaries) {
    record[key] = summary;
  }
}

function copySummary(summary: SessionSummary): SessionSummary {
  return {
    ...summary,
    errorItems: summary.errorItems.map((item) => ({ ...item })),
  };
}

export function createSessionSummary(
  groupId: string,
  mode: PracticeMode,
  items: readonly SessionSummaryItem[],
): SessionSummary {
  const safeItems = items.map((item) => sanitizeItem(item) ?? {
    id: item.id,
    char: item.char,
    pinyin: item.pinyin,
    result: item.result,
    hadError: item.hadError,
  });

  return {
    groupId,
    mode,
    successCount: safeItems.filter((item) => item.result === "correct").length,
    reviewCount: safeItems.filter((item) => item.result === "review").length,
    errorItems: safeItems
      .filter((item) => item.hadError || item.result === "review")
      .map((item) => ({ ...item })),
  };
}

export function saveSessionSummary(summary: SessionSummary): void {
  const safeSummary = sanitizeSummary(summary);
  if (!safeSummary) return;

  const key = summaryKey(safeSummary.groupId, safeSummary.mode);
  const read = readSummaryRecord();
  if (!read.ok) {
    fallbackSummaries.set(key, safeSummary);
    return;
  }

  const record = read.record;
  mergeFallbackSummaries(record);
  record[key] = safeSummary;

  const storage = getSessionStorage();
  if (!storage) {
    fallbackSummaries.set(key, safeSummary);
    return;
  }

  try {
    storage.setItem(SESSION_SUMMARY_STORAGE_KEY, JSON.stringify(record));
    fallbackSummaries.clear();
  } catch {
    fallbackSummaries.set(key, safeSummary);
  }
}

export function loadSessionSummary(
  groupId: string,
  mode: PracticeMode,
): SessionSummary | undefined {
  const key = summaryKey(groupId, mode);
  const fallback = fallbackSummaries.get(key);
  if (fallback) return copySummary(fallback);

  const read = readSummaryRecord();
  if (!read.ok) return undefined;

  const stored = read.record[key];
  return stored ? copySummary(stored) : undefined;
}
