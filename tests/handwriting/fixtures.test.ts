import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateCharacter,
  type ErrorReason,
} from "../../src/handwriting/character-evaluator";
import type {
  CharacterFileData,
  InputStroke,
  Point,
} from "../../src/handwriting/types";

type VariantName =
  | "identity"
  | "jitter"
  | "translate"
  | "scale"
  | "rotate"
  | "swap"
  | "reverse"
  | "missing"
  | "extra"
  | "wrong-shape"
  | "scribble"
  | "tap"
  | "out-of-bounds";

type CalibrationVariant = {
  name: string;
  char: "十" | "人" | "心" | "永" | "障";
  transform: VariantName;
  expected: "correct" | "incorrect" | "unclear";
  reason?: ErrorReason;
};

type RawCharacterData = {
  strokes: string[];
  medians: number[][];
};

const root = process.cwd();

function loadCharacter(char: CalibrationVariant["char"]): CharacterFileData {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(root, "node_modules/hanzi-writer-data", `${char}.json`),
      "utf8",
    ),
  ) as RawCharacterData;

  return {
    strokes: raw.strokes.map((stroke) => stroke),
    medians: raw.medians.map((median) =>
      median.map(([x, y]) => ({ x: x!, y: y! })),
    ),
  };
}

function transformPoint(
  point: Point,
  strokeIndex: number,
  pointIndex: number,
  transform: VariantName,
): Point {
  switch (transform) {
    case "jitter":
      return {
        x: point.x + ((strokeIndex + pointIndex) % 2 === 0 ? 8 : -8),
        y: point.y + ((strokeIndex + pointIndex) % 3 === 0 ? 8 : -8),
      };
    case "translate":
      return { x: point.x + 60, y: point.y + 60 };
    case "scale":
      return {
        x: 512 + (point.x - 512) * 0.85,
        y: 512 + (point.y - 512) * 0.85,
      };
    case "rotate": {
      const radians = (3 * Math.PI) / 180;
      const dx = point.x - 512;
      const dy = point.y - 512;
      return {
        x: 512 + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: 512 + dx * Math.sin(radians) + dy * Math.cos(radians),
      };
    }
    default:
      return { ...point };
  }
}

function ring(center: Point): Point[] {
  return Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * 180,
      y: center.y + Math.sin(angle) * 180,
    };
  });
}

function zigzag(offset: number): Point[] {
  return Array.from({ length: 48 }, (_, index) => ({
    x: 90 + ((index * 840) / 47) % 840,
    y: 170 + offset + (index % 2 === 0 ? -110 : 110),
  }));
}

const SAFE_PAD_MIN = -0.079 * 1024;
const SAFE_PAD_MAX = 1.079 * 1024;

function fitMediansToWritingPad(medians: Point[][]): Point[][] {
  const points = medians.flat();
  if (points.length === 0) return [];

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const alreadyFits =
    minX >= SAFE_PAD_MIN &&
    minY >= SAFE_PAD_MIN &&
    maxX <= SAFE_PAD_MAX &&
    maxY <= SAFE_PAD_MAX;

  if (alreadyFits) {
    return medians.map((stroke) => stroke.map((point) => ({ ...point })));
  }

  const safeSpan = SAFE_PAD_MAX - SAFE_PAD_MIN;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(
    1,
    width > safeSpan ? safeSpan / width : 1,
    height > safeSpan ? safeSpan / height : 1,
  );
  const scaled = points.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));
  const scaledMinX = Math.min(...scaled.map((point) => point.x));
  const scaledMaxX = Math.max(...scaled.map((point) => point.x));
  const scaledMinY = Math.min(...scaled.map((point) => point.y));
  const scaledMaxY = Math.max(...scaled.map((point) => point.y));
  const offsetX =
    scaledMinX < SAFE_PAD_MIN
      ? SAFE_PAD_MIN - scaledMinX
      : scaledMaxX > SAFE_PAD_MAX
        ? SAFE_PAD_MAX - scaledMaxX
        : 0;
  const offsetY =
    scaledMinY < SAFE_PAD_MIN
      ? SAFE_PAD_MIN - scaledMinY
      : scaledMaxY > SAFE_PAD_MAX
        ? SAFE_PAD_MAX - scaledMaxY
        : 0;

  return medians.map((stroke) =>
    stroke.map((point) => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    })),
  );
}

function resampleMedian(points: Point[], count: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: count }, () => ({ ...points[0]! }));
  }

  const segments = points.slice(1).map((point, index) => {
    const start = points[index]!;
    return { start, end: point, length: Math.hypot(point.x - start.x, point.y - start.y) };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength === 0) {
    return Array.from({ length: count }, () => ({ ...points[0]! }));
  }

  const result: Point[] = [];
  let segmentIndex = 0;
  let traversed = 0;
  for (let sampleIndex = 0; sampleIndex < count; sampleIndex += 1) {
    const distance = (totalLength * sampleIndex) / (count - 1);
    while (
      segmentIndex < segments.length - 1 &&
      distance > traversed + segments[segmentIndex]!.length
    ) {
      traversed += segments[segmentIndex]!.length;
      segmentIndex += 1;
    }
    const segment = segments[segmentIndex]!;
    const ratio = Math.min(
      1,
      Math.max(0, (distance - traversed) / Math.max(segment.length, 1)),
    );
    result.push({
      x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
      y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
    });
  }

  return result;
}

function ensureThreePoints(points: Point[]): Point[] {
  const result = points.map((point) => ({ ...point }));
  while (result.length < 3 && result.length > 1) {
    let longestIndex = 0;
    let longestLength = -1;
    for (let index = 1; index < result.length; index += 1) {
      const length = Math.hypot(
        result[index]!.x - result[index - 1]!.x,
        result[index]!.y - result[index - 1]!.y,
      );
      if (length > longestLength) {
        longestLength = length;
        longestIndex = index - 1;
      }
    }
    result.splice(longestIndex + 1, 0, {
      x: (result[longestIndex]!.x + result[longestIndex + 1]!.x) / 2,
      y: (result[longestIndex]!.y + result[longestIndex + 1]!.y) / 2,
    });
  }
  return result;
}

function toInput(
  medians: Point[][],
  options: {
    sampleCount?: number;
    ensureMinimumPoints?: boolean;
    fitToPad?: boolean;
  } = {},
): InputStroke[] {
  let prepared = medians.map((median) =>
    options.sampleCount
      ? resampleMedian(median, options.sampleCount)
      : options.ensureMinimumPoints
        ? ensureThreePoints(median)
        : median,
  );
  if (options.fitToPad) {
    prepared = fitMediansToWritingPad(prepared);
  }

  return prepared.map((median, index) => ({
    id: `fixture-${index}`,
    points: median.map((point) => ({
      x: point.x / 1024,
      y: (900 - point.y) / 1024,
    })),
  }));
}

function makeInput(
  data: CharacterFileData,
  transform: VariantName,
): InputStroke[] {
  let medians = data.medians.map((stroke, strokeIndex) =>
    stroke.map((point, pointIndex) => ({
      ...transformPoint(point, strokeIndex, pointIndex, transform),
    })),
  );

  switch (transform) {
    case "swap":
      medians = [medians[1]!, medians[0]!, ...medians.slice(2)];
      break;
    case "reverse":
      medians = [medians[0]!.slice().reverse(), ...medians.slice(1)];
      break;
    case "missing":
      medians = medians.slice(0, -1);
      break;
    case "extra":
      medians = [
        ...medians,
        [
          { x: 100, y: 100 },
          { x: 500, y: 100 },
          { x: 100, y: 140 },
        ],
      ];
      break;
    case "wrong-shape": {
      const last = medians.at(-1)!;
      const center = last[Math.floor(last.length / 2)] ?? last[0]!;
      medians = [...medians.slice(0, -1), ring(center)];
      break;
    }
    case "scribble":
      medians = medians.map((_, index) => zigzag(index * 130));
      break;
    case "tap":
      medians = [[{ x: 500, y: 500 }, { x: 500.5, y: 500 }]];
      break;
    case "out-of-bounds":
      medians = medians.map((stroke, strokeIndex) =>
        stroke.map((point, pointIndex) =>
          strokeIndex === 0 && pointIndex === 0
            ? { x: -120, y: point.y }
            : point,
        ),
      );
      break;
    case "identity":
    case "jitter":
    case "translate":
    case "scale":
    case "rotate":
      break;
  }

  return toInput(medians, { fitToPad: transform === "identity" });
}

const variants: CalibrationVariant[] = [
  { name: "accurate 十", char: "十", transform: "identity", expected: "correct" },
  { name: "jittered 人", char: "人", transform: "jitter", expected: "correct" },
  { name: "translated 心", char: "心", transform: "translate", expected: "correct" },
  { name: "scaled 永", char: "永", transform: "scale", expected: "correct" },
  { name: "rotated 十", char: "十", transform: "rotate", expected: "correct" },
  {
    name: "swapped 十",
    char: "十",
    transform: "swap",
    expected: "incorrect",
    reason: "stroke_order",
  },
  {
    name: "reversed 人",
    char: "人",
    transform: "reverse",
    expected: "incorrect",
    reason: "stroke_direction",
  },
  {
    name: "missing 十",
    char: "十",
    transform: "missing",
    expected: "incorrect",
    reason: "stroke_count",
  },
  {
    name: "extra 十",
    char: "十",
    transform: "extra",
    expected: "incorrect",
    reason: "stroke_count",
  },
  {
    name: "wrong-shape 心",
    char: "心",
    transform: "wrong-shape",
    expected: "incorrect",
    reason: "stroke_shape",
  },
  {
    name: "scribbled 永",
    char: "永",
    transform: "scribble",
    expected: "unclear",
    reason: "ink_quality",
  },
  {
    name: "tapped 心",
    char: "心",
    transform: "tap",
    expected: "unclear",
    reason: "ink_quality",
  },
  {
    name: "out-of-bounds 十",
    char: "十",
    transform: "out-of-bounds",
    expected: "unclear",
    reason: "ink_quality",
  },
];

type ContentCharacterItem = {
  char: string;
};

type ContentFile = {
  counts: { uniqueTargets: number };
  groups: Array<{
    reading: ContentCharacterItem[];
    writing: ContentCharacterItem[];
  }>;
};

function loadContentCharacters(): string[] {
  const content = JSON.parse(
    fs.readFileSync(path.join(root, "public/content.json"), "utf8"),
  ) as ContentFile;
  const characters = new Set(
    content.groups.flatMap((group) =>
      [...group.reading, ...group.writing].map((item) => item.char),
    ),
  );

  expect(content.counts.uniqueTargets).toBe(413);
  return [...characters].sort();
}

describe("real Hanzi Writer calibration fixtures", () => {
  it("defines all 13 required calibration samples", () => {
    expect(variants).toHaveLength(13);
    expect(new Set(variants.map((variant) => variant.name)).size).toBe(13);
  });

  it.each(variants)("$name -> $expected", (variant) => {
    const character = loadCharacter(variant.char);
    const result = evaluateCharacter(makeInput(character, variant.transform), character);

    expect(result.verdict).toBe(variant.expected);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    if (variant.expected === "correct") {
      expect(result.reasons).toEqual([]);
    } else {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons).toContain(variant.reason);
    }

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/"points"|"strokes"|"id"/);
  });

  it("normalizes the official 障 median at y=-86 into the writing pad", () => {
    const character = loadCharacter("障");
    expect(character.medians.flat().some((point) => point.y === -86)).toBe(true);

    const exact = evaluateCharacter(makeInput(character, "identity"), character);
    const outside = evaluateCharacter(
      makeInput(character, "out-of-bounds"),
      character,
    );

    expect(exact.verdict).toBe("correct");
    expect(exact.reasons).toEqual([]);
    expect(outside.verdict).toBe("unclear");
    expect(outside.reasons).toEqual(["ink_quality"]);
  });

  it("accepts sparse exact-median input for all 413 content characters", () => {
    const characters = loadContentCharacters();
    expect(characters).toHaveLength(413);

    const verdictCounts = { correct: 0, incorrect: 0, unclear: 0 };
    const failures: Array<{
      char: string;
      verdict: string;
      reasons: ErrorReason[];
    }> = [];

    for (const char of characters) {
      const character = loadCharacter(char);
      const result = evaluateCharacter(
        toInput(character.medians, {
          ensureMinimumPoints: true,
          fitToPad: true,
        }),
        character,
      );
      verdictCounts[result.verdict] += 1;
      if (result.verdict !== "correct") {
        failures.push({ char, verdict: result.verdict, reasons: result.reasons });
      }
    }

    expect(verdictCounts).toEqual({ correct: 413, incorrect: 0, unclear: 0 });
    expect(failures).toEqual([]);
  }, 20_000);

  it("accepts 40-point dense exact-median input for all 413 content characters", () => {
    const characters = loadContentCharacters();
    const verdictCounts = { correct: 0, incorrect: 0, unclear: 0 };
    const failures: Array<{
      char: string;
      verdict: string;
      reasons: ErrorReason[];
    }> = [];

    for (const char of characters) {
      const character = loadCharacter(char);
      const result = evaluateCharacter(
        toInput(character.medians, { sampleCount: 40, fitToPad: true }),
        character,
      );
      verdictCounts[result.verdict] += 1;
      if (result.verdict !== "correct") {
        failures.push({ char, verdict: result.verdict, reasons: result.reasons });
      }
    }

    expect(verdictCounts).toEqual({ correct: 413, incorrect: 0, unclear: 0 });
    expect(failures).toEqual([]);
  }, 20_000);

  it("never accepts endpoint-only median traces for any of the 413 characters", () => {
    const characters = loadContentCharacters();
    const verdictCounts = { correct: 0, incorrect: 0, unclear: 0 };

    for (const char of characters) {
      const character = loadCharacter(char);
      const endpoints = character.medians.map((median) => [
        median[0]!,
        median.at(-1)!,
      ]);
      const result = evaluateCharacter(toInput(endpoints, { fitToPad: true }), character);
      verdictCounts[result.verdict] += 1;
    }

    expect(verdictCounts).toEqual({ correct: 0, incorrect: 0, unclear: 413 });
  });
});
