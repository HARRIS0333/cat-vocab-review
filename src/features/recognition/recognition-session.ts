import type { PracticeItem } from "../../content/types";

export type RecognitionStatus = "known" | "review";

export type RecognitionResult = {
  id: string;
  char: string;
  pinyin: string;
  status: RecognitionStatus;
};

export type RecognitionState = {
  items: PracticeItem[];
  index: number;
  currentItem: PracticeItem | undefined;
  revealed: boolean;
  completed: boolean;
  results: RecognitionResult[];
};

export type RecognitionAction =
  | { type: "reveal" }
  | { type: "answer"; status: RecognitionStatus };

export function createRecognitionState(
  items: readonly PracticeItem[],
): RecognitionState {
  return {
    items: [...items],
    index: 0,
    currentItem: items[0],
    revealed: false,
    completed: items.length === 0,
    results: [],
  };
}

export function recognitionReducer(
  state: RecognitionState,
  action: RecognitionAction,
): RecognitionState {
  if (state.completed) return state;

  if (action.type === "reveal") {
    if (state.revealed) return state;
    return { ...state, revealed: true };
  }

  const currentItem = state.items[state.index];
  if (!state.revealed || !currentItem) return state;

  const results = [
    ...state.results,
    {
      id: currentItem.id,
      char: currentItem.char,
      pinyin: currentItem.pinyin,
      status: action.status,
    },
  ];
  const nextIndex = state.index + 1;
  const completed = nextIndex >= state.items.length;

  return {
    ...state,
    index: nextIndex,
    currentItem: completed ? undefined : state.items[nextIndex],
    revealed: false,
    completed,
    results,
  };
}
