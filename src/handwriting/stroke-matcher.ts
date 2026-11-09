import { polylineLength, resamplePolyline } from "./preprocess";
import {
  DEFAULT_THRESHOLDS,
  type HandwritingThresholds,
} from "./thresholds";
import type { Point } from "./types";

const SAMPLE_COUNT = 24;
const MINIMUM_DIRECTION_VECTOR_LENGTH = 5;

const SCORE_WEIGHTS = {
  meanDistance: 0.25,
  startEndDistance: 0.2,
  shapeDistance: 0.25,
  lengthRatio: 0.2,
  directionSimilarity: 0.1,
} as const;

export type StrokeMetrics = {
  meanDistance: number;
  startDistance: number;
  endDistance: number;
  shapeDistance: number;
  actualLength: number;
  expectedLength: number;
  lengthRatio: number;
  directionSimilarity: number;
  score: number;
};

export type StrokeMatch = {
  matched: boolean;
  reverseMatched: boolean;
  forward: StrokeMetrics;
  reverse: StrokeMetrics | null;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function squaredDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentLengthSquared = squaredDistance(start, end);
  if (segmentLengthSquared === 0) return distance(point, start);

  const projection = clamp(
    ((point.x - start.x) * (end.x - start.x) +
      (point.y - start.y) * (end.y - start.y)) /
      segmentLengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + (end.x - start.x) * projection),
    point.y - (start.y + (end.y - start.y) * projection),
  );
}

function distanceToPolyline(point: Point, polyline: Point[]): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) return distance(point, polyline[0]!);

  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    nearest = Math.min(
      nearest,
      distanceToSegment(point, polyline[index - 1]!, polyline[index]!),
    );
  }
  return nearest;
}

function bidirectionalMeanDistance(actual: Point[], expected: Point[]): number {
  let actualToExpected = 0;
  for (const point of actual) {
    actualToExpected += distanceToPolyline(point, expected);
  }

  let expectedToActual = 0;
  for (const point of expected) {
    expectedToActual += distanceToPolyline(point, actual);
  }

  return (
    (actualToExpected / actual.length + expectedToActual / expected.length) / 2
  );
}

function centerAndNormalize(points: Point[]): Point[] {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= points.length;
  center.y /= points.length;

  const centered = points.map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
  }));
  const meanSquaredRadius =
    centered.reduce((sum, point) => sum + squaredDistance(point, { x: 0, y: 0 }), 0) /
    centered.length;
  const scale = Math.sqrt(meanSquaredRadius);
  if (scale === 0) return centered;

  return centered.map((point) => ({ x: point.x / scale, y: point.y / scale }));
}

function meanShapeDistance(actual: Point[], expected: Point[]): number {
  const normalizedActual = centerAndNormalize(actual);
  const normalizedExpected = centerAndNormalize(expected);

  let total = 0;
  for (let index = 0; index < normalizedActual.length; index += 1) {
    total += distance(normalizedActual[index]!, normalizedExpected[index]!);
  }
  return total / normalizedActual.length;
}

function directionSimilarity(actual: Point[], expected: Point[]): number {
  const actualStart = actual[0]!;
  const actualEnd = actual.at(-1)!;
  const expectedStart = expected[0]!;
  const expectedEnd = expected.at(-1)!;
  const actualX = actualEnd.x - actualStart.x;
  const actualY = actualEnd.y - actualStart.y;
  const expectedX = expectedEnd.x - expectedStart.x;
  const expectedY = expectedEnd.y - expectedStart.y;
  const actualVectorLength = Math.hypot(actualX, actualY);
  const expectedVectorLength = Math.hypot(expectedX, expectedY);

  if (
    actualVectorLength < MINIMUM_DIRECTION_VECTOR_LENGTH ||
    expectedVectorLength < MINIMUM_DIRECTION_VECTOR_LENGTH
  ) {
    return 1;
  }

  return clamp(
    (actualX * expectedX + actualY * expectedY) /
      (actualVectorLength * expectedVectorLength),
    -1,
    1,
  );
}

function normalizeUpperMetric(value: number, threshold: number): number {
  if (threshold <= 0) return value <= 0 ? 1 : 0;
  return 1 - clamp(value / threshold, 0, 1);
}

function normalizeLengthRatio(ratio: number): number {
  if (ratio <= 0) return 0;
  return clamp(Math.min(ratio, 1 / ratio), 0, 1);
}

function calculateScore(
  metrics: Omit<StrokeMetrics, "score">,
  thresholds: HandwritingThresholds,
): number {
  const meanDistanceScore = normalizeUpperMetric(
    metrics.meanDistance,
    thresholds.meanDistance,
  );
  const startEndScore =
    (normalizeUpperMetric(metrics.startDistance, thresholds.startEndDistance) +
      normalizeUpperMetric(metrics.endDistance, thresholds.startEndDistance)) /
    2;
  const shapeScore = normalizeUpperMetric(
    metrics.shapeDistance,
    thresholds.shapeDistance,
  );
  const lengthScore = normalizeLengthRatio(metrics.lengthRatio);
  const directionScore = clamp((metrics.directionSimilarity + 1) / 2, 0, 1);

  return clamp(
    meanDistanceScore * SCORE_WEIGHTS.meanDistance +
      startEndScore * SCORE_WEIGHTS.startEndDistance +
      shapeScore * SCORE_WEIGHTS.shapeDistance +
      lengthScore * SCORE_WEIGHTS.lengthRatio +
      directionScore * SCORE_WEIGHTS.directionSimilarity,
    0,
    1,
  );
}

function evaluateStroke(
  actual: Point[],
  expected: Point[],
  thresholds: HandwritingThresholds,
): StrokeMetrics {
  const sampledActual = resamplePolyline(actual, SAMPLE_COUNT);
  const sampledExpected = resamplePolyline(expected, SAMPLE_COUNT);
  const actualLength = polylineLength(actual);
  const expectedLength = polylineLength(expected);
  const metricsWithoutScore = {
    meanDistance: bidirectionalMeanDistance(sampledActual, sampledExpected),
    startDistance: distance(sampledActual[0]!, sampledExpected[0]!),
    endDistance: distance(sampledActual.at(-1)!, sampledExpected.at(-1)!),
    shapeDistance: meanShapeDistance(sampledActual, sampledExpected),
    actualLength,
    expectedLength,
    lengthRatio: actualLength / Math.max(expectedLength, 1),
    directionSimilarity: directionSimilarity(sampledActual, sampledExpected),
  };

  return {
    ...metricsWithoutScore,
    score: calculateScore(metricsWithoutScore, thresholds),
  };
}

function metricsPass(
  metrics: StrokeMetrics,
  thresholds: HandwritingThresholds,
): boolean {
  return (
    metrics.meanDistance <= thresholds.meanDistance &&
    metrics.startDistance <= thresholds.startEndDistance &&
    metrics.endDistance <= thresholds.startEndDistance &&
    metrics.shapeDistance <= thresholds.shapeDistance &&
    metrics.lengthRatio >= thresholds.minimumLengthRatio &&
    metrics.lengthRatio <= thresholds.maximumLengthRatio &&
    metrics.directionSimilarity >= thresholds.minimumDirectionSimilarity
  );
}

function emptyMetrics(): StrokeMetrics {
  return {
    meanDistance: 0,
    startDistance: 0,
    endDistance: 0,
    shapeDistance: 0,
    actualLength: 0,
    expectedLength: 0,
    lengthRatio: 0,
    directionSimilarity: 0,
    score: 0,
  };
}

export function matchStroke(
  actual: Point[],
  expected: Point[],
  thresholds: HandwritingThresholds = DEFAULT_THRESHOLDS,
): StrokeMatch {
  if (actual.length === 0 || expected.length === 0) {
    return {
      matched: false,
      reverseMatched: false,
      forward: emptyMetrics(),
      reverse: null,
    };
  }

  const forward = evaluateStroke(actual, expected, thresholds);
  if (metricsPass(forward, thresholds)) {
    return {
      matched: true,
      reverseMatched: false,
      forward,
      reverse: null,
    };
  }

  const reverse = evaluateStroke([...actual].reverse(), expected, thresholds);
  return {
    matched: false,
    reverseMatched: metricsPass(reverse, thresholds),
    forward,
    reverse,
  };
}
