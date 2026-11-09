import { describe, expect, it } from "vitest";
import { evaluateCharacter } from "./character-evaluator";
import { DEFAULT_THRESHOLDS, type HandwritingThresholds } from "./thresholds";
import type { CharacterFileData, InputStroke, Point } from "./types";

type Median = Point[];

function makeData(...medians: Median[]): CharacterFileData {
  return {
    strokes: medians.map(() => ""),
    medians,
  };
}

function strokes(...medians: Median[]): InputStroke[] {
  return medians.map((points, index) => ({
    id: `s${index}`,
    points: points.map((point) => ({
      x: point.x / 1024,
      y: (900 - point.y) / 1024,
    })),
  }));
}

function screenStrokes(...medians: Median[]): InputStroke[] {
  return medians.map((points, index) => ({
    id: `screen-${index}`,
    points: points.map((point) => ({
      x: point.x / 1024,
      y: point.y / 1024,
    })),
  }));
}

function line(y: number, startX: number, endX: number): Median {
  return Array.from({ length: 4 }, (_, index) => ({
    x: startX + ((endX - startX) * index) / 3,
    y,
  }));
}

function verticalLine(x: number, startY: number, endY: number): Median {
  return Array.from({ length: 4 }, (_, index) => ({
    x,
    y: startY + ((endY - startY) * index) / 3,
  }));
}

const shi = makeData(
  [
    { x: 120, y: 512 },
    { x: 512, y: 512 },
    { x: 900, y: 512 },
  ],
  [
    { x: 512, y: 120 },
    { x: 512, y: 512 },
    { x: 512, y: 900 },
  ],
);

function highDistanceThresholds(): HandwritingThresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    meanDistance: 1000,
    startEndDistance: 1000,
  };
}

describe("character evaluator", () => {
  it("keeps production thresholds explicit and calibrated", () => {
    expect(DEFAULT_THRESHOLDS.minimumPointCount).toBe(3);
    expect(DEFAULT_THRESHOLDS.outOfBoundsTolerance).toBe(0.08);
    expect(DEFAULT_THRESHOLDS.shapeDistance).toBe(0.48);
    expect(DEFAULT_THRESHOLDS.minimumOrderScoreAdvantage).toBe(0.12);
  });

  it("returns correct for exact ordered strokes", () => {
    const result = evaluateCharacter(strokes(...shi.medians), shi);
    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
    expect(result.confidence).toBeGreaterThan(0.99);
  });

  it("accepts a vertical stroke captured top-to-bottom on the writing pad", () => {
    const data = makeData(verticalLine(512, 800, 0));
    const result = evaluateCharacter(
      screenStrokes([
        { x: 512, y: 100 },
        { x: 512, y: 500 },
        { x: 512, y: 900 },
      ]),
      data,
    );

    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
  });

  it("prioritizes stroke count over shape mismatches", () => {
    const result = evaluateCharacter(strokes(shi.medians[0]!), shi);
    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toContain("stroke_count");
  });

  it("prefers correct identity matches over an incidental non-identity assignment", () => {
    const data = makeData(line(300, 100, 900), line(530, 100, 900));
    const result = evaluateCharacter(strokes(...data.medians), data);

    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
  });

  it("prioritizes a complete wrong-order assignment over reversed identity strokes", () => {
    const downward = verticalLine(512, 120, 900);
    const upward = [...downward].reverse();
    const data = makeData(downward, upward);
    const result = evaluateCharacter(strokes(upward, downward), data);

    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toEqual(["stroke_order"]);
  });

  it("detects swapped stroke order", () => {
    const result = evaluateCharacter(
      strokes(shi.medians[1]!, shi.medians[0]!),
      shi,
    );
    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toContain("stroke_order");
  });

  it("detects reversed direction when order is otherwise correct", () => {
    const reversedVertical = [...shi.medians[1]!].reverse();
    const result = evaluateCharacter(
      strokes(shi.medians[0]!, reversedVertical),
      shi,
    );
    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toContain("stroke_direction");
  });

  it("returns unclear for a single accidental tap", () => {
    const result = evaluateCharacter(
      [{ id: "tap", points: [{ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 }] }],
      shi,
    );
    expect(result.verdict).toBe("unclear");
    expect(result.reasons).toEqual(["ink_quality"]);
  });

  it("does not accept a stroke represented only by its endpoints", () => {
    const data = makeData(line(512, 120, 900));
    const median = data.medians[0]!;
    const result = evaluateCharacter(
      strokes([median[0]!, median.at(-1)!]),
      data,
    );

    expect(result.verdict).toBe("unclear");
    expect(result.reasons).toEqual(["ink_quality"]);
  });

  it("classifies excessive disconnected scribbling as unclear ink", () => {
    const zigzag = (offset: number): Median =>
      Array.from({ length: 32 }, (_, index) => ({
        x: 120 + ((index * 780) / 31) % 780,
        y: 220 + offset + (index % 2 === 0 ? -120 : 120),
      }));
    const result = evaluateCharacter(strokes(zigzag(0), zigzag(180)), shi);

    expect(result.verdict).toBe("unclear");
    expect(result.reasons).toEqual(["ink_quality"]);
  });

  it("returns unclear when every mismatch stays inside the ambiguity band", () => {
    const data = makeData(line(512, 120, 900));
    const tooShort = strokes([
      { x: 387, y: 512 },
      { x: 512, y: 512 },
      { x: 637, y: 512 },
    ]);
    const result = evaluateCharacter(tooShort, data);

    expect(result.verdict).toBe("unclear");
    expect(result.reasons).toEqual(["ink_quality"]);
  });

  it("detects writing outside the normalized pad before matching", () => {
    const outside = shi.medians[0]!.map((point, index) =>
      index === 0 ? { x: -120, y: point.y } : point,
    );
    const result = evaluateCharacter(
      strokes(outside, shi.medians[1]!),
      shi,
    );

    expect(result.verdict).toBe("unclear");
    expect(result.reasons).toEqual(["ink_quality"]);
  });

  it("accepts an exact horizontal character with a degenerate bounding box", () => {
    const data = makeData(line(512, 120, 900));
    const result = evaluateCharacter(strokes(line(512, 120, 900)), data);

    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
  });

  it("accepts a slightly jittered single horizontal stroke", () => {
    const data = makeData(line(512, 120, 900));
    const jittered = strokes([
      { x: 120, y: 512 },
      { x: 380, y: 516 },
      { x: 640, y: 508 },
      { x: 900, y: 512 },
    ]);
    const result = evaluateCharacter(jittered, data);

    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
  });

  it("accepts a slightly jittered single vertical stroke", () => {
    const data = makeData([
      { x: 512, y: 120 },
      { x: 512, y: 380 },
      { x: 512, y: 640 },
      { x: 512, y: 900 },
    ]);
    const jittered = strokes([
      { x: 512, y: 120 },
      { x: 516, y: 380 },
      { x: 508, y: 640 },
      { x: 512, y: 900 },
    ]);
    const result = evaluateCharacter(jittered, data);

    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
  });

  it("accepts a correctly ordered character written at a smaller scale", () => {
    const data = makeData(
      line(300, 120, 900),
      verticalLine(512, 300, 860),
    );
    const scale = 0.62;
    const scaled = data.medians.map((median) =>
      median.map((point) => ({
        x: 512 + (point.x - 512) * scale,
        y: 512 + (point.y - 512) * scale,
      })),
    );
    const result = evaluateCharacter(strokes(...scaled), data);

    expect(result.verdict).toBe("correct");
    expect(result.reasons).toEqual([]);
  });

  it("rejects individually matching strokes when the whole character is compressed", () => {
    const data = makeData(line(400, 100, 220), line(600, 760, 880));
    const compressed = strokes(line(400, 350, 470), line(600, 510, 630));
    const result = evaluateCharacter(compressed, data);

    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toEqual(["stroke_shape"]);
    expect(result.strokeMatches.every((match) => match.matched)).toBe(true);
  });

  it("rejects a whole character whose student bounds do not overlap the model", () => {
    const data = makeData(line(400, 100, 220), line(600, 160, 280));
    const shifted = strokes(line(400, 350, 470), line(600, 410, 530));
    const result = evaluateCharacter(shifted, data);

    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toEqual(["stroke_shape"]);
  });

  it("rejects an excessive student/model center distance", () => {
    const thresholds = highDistanceThresholds();
    const data = makeData(line(300, 100, 220), line(600, 100, 220));
    const shifted = strokes(line(300, 760, 880), line(600, 760, 880));
    const result = evaluateCharacter(shifted, data, thresholds);

    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toEqual(["stroke_shape"]);
  });

  it("finds a complete non-identity assignment for a three-stroke order error", () => {
    const data = makeData(
      line(200, 100, 220),
      line(500, 100, 220),
      line(800, 100, 220),
    );
    const result = evaluateCharacter(
      strokes(data.medians[1]!, data.medians[2]!, data.medians[0]!),
      data,
    );

    expect(result.verdict).toBe("incorrect");
    expect(result.reasons).toEqual(["stroke_order"]);
  });

  it("keeps confidence bounded and returns no raw handwriting", () => {
    const result = evaluateCharacter(
      strokes(shi.medians[1]!, shi.medians[0]!),
      shi,
    );
    const serialized = JSON.stringify(result);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Object.keys(result).sort()).toEqual([
      "confidence",
      "reasons",
      "strokeMatches",
      "verdict",
    ]);
    expect(serialized).not.toMatch(/"points"|"strokes"|"id"/);
    for (const match of result.strokeMatches) {
      expect(Object.keys(match).sort()).toEqual([
        "actualIndex",
        "expectedIndex",
        "forward",
        "matched",
        "reverse",
        "reverseMatched",
        "score",
      ]);
    }
  });

  it("does not mutate input strokes, character data, or custom thresholds", () => {
    const thresholds: HandwritingThresholds = {
      ...DEFAULT_THRESHOLDS,
      meanDistance: 360,
    };
    const input = strokes(shi.medians[1]!, shi.medians[0]!);
    const inputSnapshot = structuredClone(input);
    const dataSnapshot = structuredClone(shi);
    const thresholdsSnapshot = { ...thresholds };

    evaluateCharacter(input, shi, thresholds);

    expect(input).toEqual(inputSnapshot);
    expect(shi).toEqual(dataSnapshot);
    expect(thresholds).toEqual(thresholdsSnapshot);
  });
});
