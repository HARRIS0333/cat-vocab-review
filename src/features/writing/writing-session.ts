import type { PracticeItem } from "../../content/types";
import type { Evaluation } from "../../handwriting/character-evaluator";
import type { InputStroke } from "../../handwriting/types";
import type { SessionSummaryItem } from "../session/session-summary";

export type WritingPhase =
  | "answering"
  | "evaluating"
  | "correct"
  | "incorrect"
  | "unclear";

export type WritingSessionState = {
  items: PracticeItem[];
  index: number;
  phase: WritingPhase;
  strokes: InputStroke[];
  evaluation: Evaluation | null;
  hadError: boolean;
  attempt: number;
  results: SessionSummaryItem[];
  completed: boolean;
  readonly currentItem: PracticeItem | undefined;
};

export type WritingSessionAction =
  | { type: "submit"; strokes: InputStroke[] }
  | { type: "evaluated"; evaluation: Evaluation }
  | { type: "retry" }
  | { type: "skip" }
  | { type: "load-failed" }
  | { type: "next" };

type WritingSessionBase = Omit<WritingSessionState, "currentItem">;

function createState(base: WritingSessionBase): WritingSessionState {
  const state = { ...base } as WritingSessionState;
  Object.defineProperty(state, "currentItem", {
    enumerable: true,
    configurable: false,
    get() {
      return state.completed ? undefined : state.items[state.index];
    },
  });
  return state;
}

export function createWritingSession(
  items: readonly PracticeItem[],
): WritingSessionState {
  const copiedItems = [...items];
  return createState({
    items: copiedItems,
    index: 0,
    phase: "answering",
    strokes: [],
    evaluation: null,
    hadError: false,
    attempt: 0,
    results: [],
    completed: copiedItems.length === 0,
  });
}

function summaryResult(
  item: PracticeItem,
  result: SessionSummaryItem["result"],
  hadError: boolean,
): SessionSummaryItem {
  return {
    id: item.id,
    char: item.char,
    pinyin: item.pinyin,
    result,
    hadError,
  };
}

function advance(
  state: WritingSessionState,
  result: SessionSummaryItem,
): WritingSessionState {
  const nextIndex = state.index + 1;
  const completed = nextIndex >= state.items.length;

  return createState({
    items: state.items,
    index: nextIndex,
    phase: "answering",
    strokes: [],
    evaluation: null,
    hadError: false,
    attempt: 0,
    results: [...state.results, result],
    completed,
  });
}

export function writingSessionReducer(
  state: WritingSessionState,
  action: WritingSessionAction,
): WritingSessionState {
  if (state.completed) return state;

  if (action.type === "submit") {
    if (state.phase !== "answering" || action.strokes.length === 0) return state;
    return createState({
      items: state.items,
      index: state.index,
      phase: "evaluating",
      strokes: [...action.strokes],
      evaluation: null,
      hadError: state.hadError,
      attempt: state.attempt,
      results: state.results,
      completed: false,
    });
  }

  if (action.type === "evaluated") {
    if (state.phase !== "evaluating") return state;
    const verdict = action.evaluation.verdict;

    return createState({
      items: state.items,
      index: state.index,
      phase: verdict,
      strokes: state.strokes,
      evaluation: action.evaluation,
      hadError: state.hadError || verdict === "incorrect",
      attempt: state.attempt + 1,
      results: state.results,
      completed: false,
    });
  }

  if (action.type === "retry") {
    if (state.phase !== "incorrect" && state.phase !== "unclear") return state;
    return createState({
      items: state.items,
      index: state.index,
      phase: "answering",
      strokes: [],
      evaluation: null,
      hadError: state.hadError,
      attempt: state.attempt,
      results: state.results,
      completed: false,
    });
  }

  const currentItem = state.currentItem;
  if (!currentItem) return state;

  if (action.type === "next") {
    if (state.phase !== "correct") return state;
    return advance(
      state,
      summaryResult(currentItem, "correct", state.hadError),
    );
  }

  if (action.type === "skip") {
    if (state.phase !== "incorrect") return state;
    return advance(state, summaryResult(currentItem, "review", true));
  }

  if (action.type === "load-failed" && state.phase === "answering") {
    return advance(state, summaryResult(currentItem, "review", true));
  }

  return state;
}
