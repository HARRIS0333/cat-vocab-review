import { describe, expect, it } from "vitest";
import {
  CHARACTER_SIZE,
  getBoundingBox,
  polylineLength,
  preprocessStrokes,
  resamplePolyline,
  toCharacterCoordinates,
} from "./preprocess";

describe("handwriting preprocessing", () => {
  it("maps normalized square coordinates to 1024 character coordinates", () => {
    expect(
      toCharacterCoordinates({
        id: "s1",
        points: [{ x: 0.1, y: 0.25 }, { x: 1, y: 0.75 }],
      }),
    ).toEqual([
      { x: 102.4, y: 256 },
      { x: CHARACTER_SIZE, y: 768 },
    ]);
  });

  it("removes duplicate sampling points and resamples to a stable count", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 1000, y: 0 },
    ];
    expect(resamplePolyline(points, 8)).toHaveLength(8);
  });

  it("discards taps that are too short", () => {
    const result = preprocessStrokes([
      { id: "tap", points: [{ x: 0.2, y: 0.2 }, { x: 0.201, y: 0.2 }] },
      {
        id: "line",
        points: [{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 }],
      },
    ]);
    expect(result.map((stroke) => stroke.id)).toEqual(["line"]);
  });

  it("calculates length and bounds in character coordinates", () => {
    const points = [{ x: 100, y: 200 }, { x: 400, y: 600 }];
    expect(polylineLength(points)).toBe(500);
    expect(getBoundingBox(points)).toEqual({
      minX: 100,
      minY: 200,
      maxX: 400,
      maxY: 600,
      width: 300,
      height: 400,
    });
  });
});

describe("handwriting preprocessing edge cases", () => {
  it("preserves stroke order and each stroke's point direction", () => {
    const result = preprocessStrokes([
      {
        id: "down",
        points: [
          { x: 0.8, y: 0.8 },
          { x: 0.5, y: 0.5 },
          { x: 0.2, y: 0.2 },
        ],
      },
      {
        id: "up",
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.5, y: 0.5 },
          { x: 0.8, y: 0.8 },
        ],
      },
    ]);

    expect(result.map((stroke) => stroke.id)).toEqual(["down", "up"]);
    expect(result[0]!.points[0]).toEqual({ x: 819.2, y: 819.2 });
    expect(result[0]!.points.at(-1)).toEqual({ x: 204.8, y: 204.8 });
    expect(result[1]!.points[0]).toEqual({ x: 204.8, y: 204.8 });
    expect(result[1]!.points.at(-1)).toEqual({ x: 819.2, y: 819.2 });
    expect(result[0]!.points).toHaveLength(32);
    expect(result[0]!.length).toBeCloseTo(Math.hypot(614.4, 614.4), 10);
    expect(result[0]!.bounds).toEqual({
      minX: 204.8,
      minY: 204.8,
      maxX: 819.2,
      maxY: 819.2,
      width: expect.closeTo(614.4, 10),
      height: expect.closeTo(614.4, 10),
    });
  });

  it("drops points closer than two units but keeps a point exactly at the threshold", () => {
    const result = preprocessStrokes(
      [
        {
          id: "at-threshold",
          points: [
            { x: 0, y: 0 },
            { x: 1.2 / CHARACTER_SIZE, y: 1.6 / CHARACTER_SIZE },
            { x: 100 / CHARACTER_SIZE, y: 0 },
          ],
        },
        {
          id: "below-threshold",
          points: [
            { x: 0, y: 0 },
            { x: 1.1988 / CHARACTER_SIZE, y: 1.5984 / CHARACTER_SIZE },
            { x: 100 / CHARACTER_SIZE, y: 0 },
          ],
        },
      ],
      { minimumPointCount: 3 },
    );

    expect(result.map((stroke) => stroke.id)).toEqual(["at-threshold"]);
    expect(result[0]!.length).toBeCloseTo(
      2 + Math.hypot(98.8, 1.6),
      10,
    );
  });

  it("requires three cleaned points and a length of at least 32 units", () => {
    const result = preprocessStrokes([
      {
        id: "two-points",
        points: [{ x: 0, y: 0 }, { x: 100 / CHARACTER_SIZE, y: 0 }],
      },
      {
        id: "exact-boundary",
        points: [
          { x: 0, y: 0 },
          { x: 16 / CHARACTER_SIZE, y: 0 },
          { x: 16 / CHARACTER_SIZE, y: 16 / CHARACTER_SIZE },
        ],
      },
      {
        id: "below-length",
        points: [
          { x: 0, y: 0 },
          { x: 10 / CHARACTER_SIZE, y: 0 },
          { x: 10 / CHARACTER_SIZE, y: 10 / CHARACTER_SIZE },
        ],
      },
    ]);

    expect(result.map((stroke) => stroke.id)).toEqual(["exact-boundary"]);
    expect(result[0]!.length).toBe(32);
    expect(result[0]!.points).toHaveLength(32);
  });

  it("samples a non-uniform polyline at equal arc-length intervals", () => {
    expect(
      resamplePolyline(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 30 },
        ],
        5,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 10, y: 30 },
    ]);
  });

  it("resamples to 32 points by default", () => {
    expect(
      resamplePolyline([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toHaveLength(32);
  });

  it("returns the first point repeated for a zero-length path", () => {
    expect(
      resamplePolyline(
        [
          { x: 12, y: 34 },
          { x: 12, y: 34 },
        ],
        4,
      ),
    ).toEqual([
      { x: 12, y: 34 },
      { x: 12, y: 34 },
      { x: 12, y: 34 },
      { x: 12, y: 34 },
    ]);
  });

  it("handles legal count boundaries and an empty path", () => {
    expect(
      resamplePolyline(
        [
          { x: 2, y: 3 },
          { x: 20, y: 30 },
        ],
        1,
      ),
    ).toEqual([{ x: 2, y: 3 }]);
    expect(resamplePolyline([], 8)).toEqual([]);
    expect(preprocessStrokes([])).toEqual([]);
  });

  it("returns an all-zero box for an empty point set", () => {
    expect(getBoundingBox([])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    });
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 10, y: 10 }])).toBe(0);
  });
});
