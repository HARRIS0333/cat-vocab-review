import { describe, expect, it } from "vitest";
import type { Evaluation } from "../../handwriting/character-evaluator";
import type { InputStroke } from "../../handwriting/types";
import {
  createWritingSession,
  writingSessionReducer,
} from "./writing-session";

const items = [
  { id: "lesson-1:据:jù", char: "据", pinyin: "jù", polyphone: false },
  { id: "lesson-1:墙:qiáng", char: "墙", pinyin: "qiáng", polyphone: false },
];
const stroke: InputStroke = {
  id: "s1",
  points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }],
};
const correct: Evaluation = {
  verdict: "correct",
  reasons: [],
  confidence: 1,
  strokeMatches: [],
};
const incorrect: Evaluation = {
  verdict: "incorrect",
  reasons: ["stroke_count"],
  confidence: 0.5,
  strokeMatches: [],
};
const unclear: Evaluation = {
  verdict: "unclear",
  reasons: ["ink_quality"],
  confidence: 0.2,
  strokeMatches: [],
};

describe("writing session reducer", () => {
  it("submits exactly once, evaluates, and records corrected history", () => {
    let state = createWritingSession(items);
    state = writingSessionReducer(state, { type: "submit", strokes: [stroke] });
    expect(state.phase).toBe("evaluating");
    state = writingSessionReducer(state, { type: "evaluated", evaluation: incorrect });
    expect(state.phase).toBe("incorrect");
    expect(state.hadError).toBe(true);
    state = writingSessionReducer(state, { type: "retry" });
    expect(state.phase).toBe("answering");
    expect(state.strokes).toEqual([]);
    state = writingSessionReducer(state, { type: "submit", strokes: [stroke] });
    state = writingSessionReducer(state, { type: "evaluated", evaluation: correct });
    state = writingSessionReducer(state, { type: "next" });
    expect(state.index).toBe(1);
    expect(state.results[0]).toEqual({
      id: items[0]!.id,
      char: "据",
      pinyin: "jù",
      result: "correct",
      hadError: true,
    });
  });

  it("rejects a second submit while the first is evaluating", () => {
    let state = createWritingSession(items);
    state = writingSessionReducer(state, { type: "submit", strokes: [stroke] });
    const evaluating = state;

    state = writingSessionReducer(state, {
      type: "submit",
      strokes: [{ ...stroke, id: "s2" }],
    });

    expect(state).toBe(evaluating);
    expect(state.phase).toBe("evaluating");
    expect(state.strokes).toEqual([stroke]);
  });

  it("keeps unclear in place and does not mark an error", () => {
    let state = createWritingSession(items);
    state = writingSessionReducer(state, { type: "submit", strokes: [stroke] });
    state = writingSessionReducer(state, { type: "evaluated", evaluation: unclear });
    expect(state.phase).toBe("unclear");
    expect(state.hadError).toBe(false);
    expect(state.index).toBe(0);
    state = writingSessionReducer(state, { type: "retry" });
    expect(state.phase).toBe("answering");
    expect(state.strokes).toEqual([]);
  });

  it("skips an incorrect item as review and completes after the last item", () => {
    let state = createWritingSession([items[0]!]);
    state = writingSessionReducer(state, { type: "submit", strokes: [stroke] });
    state = writingSessionReducer(state, { type: "evaluated", evaluation: incorrect });
    state = writingSessionReducer(state, { type: "skip" });
    expect(state.completed).toBe(true);
    expect(state.currentItem).toBeUndefined();
    expect(state.results).toEqual([
      {
        id: items[0]!.id,
        char: "据",
        pinyin: "jù",
        result: "review",
        hadError: true,
      },
    ]);
  });

  it("records unavailable stroke data as review without evaluating", () => {
    let state = createWritingSession([items[0]!]);
    state = writingSessionReducer(state, { type: "load-failed" });
    expect(state.completed).toBe(true);
    expect(state.currentItem).toBeUndefined();
    expect(state.evaluation).toBeNull();
    expect(state.results).toEqual([
      {
        id: items[0]!.id,
        char: "据",
        pinyin: "jù",
        result: "review",
        hadError: true,
      },
    ]);
  });
});
