import type { Box, InputStroke, Point, ProcessedStroke } from "./types";

export const CHARACTER_SIZE = 1024;

const DEFAULT_DEDUPE_THRESHOLD = 2;
const DEFAULT_MINIMUM_POINT_COUNT = 3;
const DEFAULT_MINIMUM_LENGTH = 32;
const DEFAULT_SAMPLE_COUNT = 32;

export type PreprocessConfig = {
  size?: number;
  dedupeThreshold?: number;
  minimumPointCount?: number;
  minimumLength?: number;
  sampleCount?: number;
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function emptyBox(): Box {
  return {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0,
  };
}

function hasFiniteCoordinates(points: Point[]): boolean {
  return points.every(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
}

export function toCharacterCoordinates(
  stroke: InputStroke,
  size = CHARACTER_SIZE,
): Point[] {
  return stroke.points.map((point) => ({
    x: point.x * size,
    y: point.y * size,
  }));
}

export function polylineLength(points: Point[]): number {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1]!, points[index]!);
  }

  return length;
}

export function getBoundingBox(points: Point[]): Box {
  if (points.length === 0) return emptyBox();

  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = points[0]!.x;
  let maxY = points[0]!.y;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function resamplePolyline(points: Point[], count = DEFAULT_SAMPLE_COUNT): Point[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("count must be a positive integer");
  }
  if (points.length === 0) return [];
  if (!hasFiniteCoordinates(points)) {
    throw new RangeError("points must contain finite coordinates");
  }

  const first = points[0]!;
  if (count === 1) return [{ ...first }];

  const segments: Array<{
    start: Point;
    end: Point;
    length: number;
    startDistance: number;
  }> = [];
  let totalLength = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const segmentLength = distance(start, end);

    if (segmentLength === 0) continue;

    segments.push({
      start,
      end,
      length: segmentLength,
      startDistance: totalLength,
    });
    totalLength += segmentLength;
  }

  if (totalLength === 0) {
    return Array.from({ length: count }, () => ({ ...first }));
  }

  const result: Point[] = [];
  let segmentIndex = 0;

  for (let sampleIndex = 0; sampleIndex < count; sampleIndex += 1) {
    if (sampleIndex === count - 1) {
      result.push({ ...points.at(-1)! });
      break;
    }

    const targetDistance = (totalLength * sampleIndex) / (count - 1);
    while (
      segmentIndex < segments.length - 1 &&
      targetDistance > segments[segmentIndex]!.startDistance + segments[segmentIndex]!.length
    ) {
      segmentIndex += 1;
    }

    const segment = segments[segmentIndex]!;
    const ratio = Math.min(
      1,
      Math.max(0, (targetDistance - segment.startDistance) / segment.length),
    );
    result.push({
      x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
      y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
    });
  }

  return result;
}

function dedupePoints(points: Point[], threshold: number): Point[] {
  if (points.length === 0) return [];

  const deduped = [{ ...points[0]! }];

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    if (distance(deduped.at(-1)!, point) >= threshold) {
      deduped.push({ ...point });
    }
  }

  return deduped;
}

export function preprocessStrokes(
  strokes: InputStroke[],
  config: PreprocessConfig = {},
): ProcessedStroke[] {
  const {
    size = CHARACTER_SIZE,
    dedupeThreshold = DEFAULT_DEDUPE_THRESHOLD,
    minimumPointCount = DEFAULT_MINIMUM_POINT_COUNT,
    minimumLength = DEFAULT_MINIMUM_LENGTH,
    sampleCount = DEFAULT_SAMPLE_COUNT,
  } = config;
  const result: ProcessedStroke[] = [];

  for (const stroke of strokes) {
    const characterPoints = toCharacterCoordinates(stroke, size);
    if (!hasFiniteCoordinates(characterPoints)) continue;

    const points = dedupePoints(characterPoints, dedupeThreshold);
    if (points.length < minimumPointCount) continue;

    const length = polylineLength(points);
    if (!Number.isFinite(length) || length < minimumLength) continue;

    result.push({
      id: stroke.id,
      points: resamplePolyline(points, sampleCount),
      length,
      bounds: getBoundingBox(points),
    });
  }

  return result;
}
