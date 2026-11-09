import { expect, it } from "vitest";
import { normalizePointerPoint, toSvgPath } from "./pointer-geometry";

it("normalizes pointer coordinates without clamping or rounding", () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  expect(normalizePointerPoint(200, 100, rect)).toEqual({ x: 0.25, y: 0.25 });
  expect(normalizePointerPoint(90, 20, rect)).toEqual({ x: -0.025, y: -0.15 });
});

it("renders normalized points in a stable 1024 viewBox", () => {
  expect(
    toSvgPath([
      { x: 0.1, y: 0.25 },
      { x: 0.5, y: 0.75 },
    ]),
  ).toBe("M 102.4 256 L 512 768");

  expect(toSvgPath([])).toBe("");
});
