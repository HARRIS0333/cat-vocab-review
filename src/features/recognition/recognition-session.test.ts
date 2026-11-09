import { describe, expect, it } from "vitest";
import { createRecognitionState, recognitionReducer } from "./recognition-session";

const items = [
  { id: "lesson-1:浩:hào", char: "浩", pinyin: "hào", polyphone: false },
  { id: "lesson-1:崩:bēng", char: "崩", pinyin: "bēng", polyphone: false },
];

describe("recognition reducer", () => {
  it("hides pinyin until reveal", () => {
    const state = createRecognitionState(items);
    expect(state.revealed).toBe(false);
    expect(state.currentItem?.pinyin).toBe("hào");
  });

  it("records an answer and advances", () => {
    const revealed = recognitionReducer(createRecognitionState(items), {
      type: "reveal",
    });
    const next = recognitionReducer(revealed, {
      type: "answer",
      status: "review",
    });
    expect(next.index).toBe(1);
    expect(next.results[0]).toMatchObject({ id: items[0]?.id, status: "review" });
    expect(next.revealed).toBe(false);
  });

  it("completes after the final item and clears current item", () => {
    let state = createRecognitionState(items);
    state = recognitionReducer(state, { type: "reveal" });
    state = recognitionReducer(state, { type: "answer", status: "known" });
    state = recognitionReducer(state, { type: "reveal" });
    state = recognitionReducer(state, { type: "answer", status: "review" });
    expect(state.completed).toBe(true);
    expect(state.currentItem).toBeUndefined();
    expect(state.results).toHaveLength(2);
  });

  it("does not advance before reveal or after completion", () => {
    const initial = createRecognitionState(items);
    expect(recognitionReducer(initial, { type: "answer", status: "known" })).toBe(
      initial,
    );

    const completed = recognitionReducer(
      recognitionReducer(
        recognitionReducer(initial, { type: "reveal" }),
        { type: "answer", status: "known" },
      ),
      { type: "reveal" },
    );
    const last = recognitionReducer(completed, {
      type: "answer",
      status: "known",
    });
    expect(recognitionReducer(last, { type: "reveal" })).toBe(last);
  });

  it("starts empty states as completed", () => {
    const state = createRecognitionState([]);
    expect(state.currentItem).toBeUndefined();
    expect(state.completed).toBe(true);
  });
});
