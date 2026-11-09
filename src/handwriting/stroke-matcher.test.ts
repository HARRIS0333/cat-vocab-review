import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  type HandwritingThresholds,
} from "./thresholds";
import { matchStroke } from "./stroke-matcher";

const horizontal = [
  { x: 120, y: 512 },
  { x: 350, y: 512 },
  { x: 620, y: 512 },
  { x: 900, y: 512 },
];

describe("stroke matcher", () => {
  it("matches an accurate stroke", () => {
    const result = matchStroke(horizontal, horizontal);
    expect(result.matched).toBe(true);
    expect(result.forward.meanDistance).toBeCloseTo(0, 5);
    expect(result.forward.lengthRatio).toBeCloseTo(1, 5);
  });

  it("accepts minor jitter without reversing direction", () => {
    const jittered = horizontal.map((point, index) => ({
      ...point,
      y: point.y + (index % 2 === 0 ? 8 : -8),
    }));
    const result = matchStroke(jittered, horizontal);
    expect(result.matched).toBe(true);
    expect(result.reverseMatched).toBe(false);
  });

  it("detects a reversed stroke", () => {
    const result = matchStroke([...horizontal].reverse(), horizontal);
    expect(result.matched).toBe(false);
    expect(result.reverseMatched).toBe(true);
  });

  it("rejects a differently shaped stroke", () => {
    const circle = Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * Math.PI * 2;
      return { x: 512 + Math.cos(angle) * 300, y: 512 + Math.sin(angle) * 300 };
    });
    expect(matchStroke(circle, horizontal).matched).toBe(false);
    expect(matchStroke(circle, horizontal).reverseMatched).toBe(false);
  });

  it("rejects a stroke shorter than the minimum length ratio", () => {
    const short = horizontal.slice(0, 2).map((point) => ({
      x: point.x,
      y: point.y,
    }));
    expect(matchStroke(short, horizontal).matched).toBe(false);
  });
});

describe("stroke matcher edge cases", () => {
  it("returns an unmatched result for an empty point list", () => {
    const result = matchStroke([], horizontal);

    expect(result.matched).toBe(false);
    expect(result.reverseMatched).toBe(false);
    expect(Number.isFinite(result.forward.score)).toBe(true);
  });

  it("rejects non-finite coordinates", () => {
    expect(() =>
      matchStroke([{ x: Number.NaN, y: 512 }, ...horizontal], horizontal),
    ).toThrow(RangeError);
    expect(() =>
      matchStroke(horizontal, [{ x: 0, y: Number.POSITIVE_INFINITY }]),
    ).toThrow(RangeError);
  });

  it("uses custom thresholds without mutating them or the inputs", () => {
    const short = horizontal.slice(0, 2);
    const customThresholds: HandwritingThresholds = {
      ...DEFAULT_THRESHOLDS,
      meanDistance: 600,
      startEndDistance: 600,
      minimumLengthRatio: 0.2,
    };
    const thresholdsSnapshot = { ...customThresholds };
    const actualSnapshot = structuredClone(short);
    const expectedSnapshot = structuredClone(horizontal);

    const result = matchStroke(short, horizontal, customThresholds);

    expect(result.matched).toBe(true);
    expect(customThresholds).toEqual(thresholdsSnapshot);
    expect(short).toEqual(actualSnapshot);
    expect(horizontal).toEqual(expectedSnapshot);
  });

  it("keeps the score normalized between zero and one", () => {
    for (const actual of [horizontal, [...horizontal].reverse(), []]) {
      const result = matchStroke(actual, horizontal);
      expect(result.forward.score).toBeGreaterThanOrEqual(0);
      expect(result.forward.score).toBeLessThanOrEqual(1);
      if (result.reverse) {
        expect(result.reverse.score).toBeGreaterThanOrEqual(0);
        expect(result.reverse.score).toBeLessThanOrEqual(1);
      }
    }
  });
});
