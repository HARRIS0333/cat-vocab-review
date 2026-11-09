import { getBoundingBox, polylineLength, preprocessStrokes } from "./preprocess";
import type { StrokeMetrics } from "./stroke-matcher";
import { DEFAULT_THRESHOLDS, type HandwritingThresholds } from "./thresholds";
import type {
  Box,
  CharacterFileData,
  InputStroke,
  Point,
  ProcessedStroke,
} from "./types";

const CHARACTER_SIZE = 1024;
const HANZI_WRITER_TOP_Y = 900;
const POSITION_CENTER_DISTANCE = 380;
const POSITION_MINIMUM_DIAGONAL_RATIO = 0.44;
const POSITION_MAXIMUM_DIAGONAL_RATIO = 2;
const POSITION_MINIMUM_STUDENT_OVERLAP = 0.28;
const EPSILON = 1e-9;

export type Verdict = "correct" | "incorrect" | "unclear";

export type ErrorReason =
  | "stroke_count"
  | "stroke_shape"
  | "stroke_order"
  | "stroke_direction"
  | "ink_quality";

export type StrokeMatchDetail = {
  actualIndex: number;
  expectedIndex: number;
  matched: boolean;
  reverseMatched: boolean;
  score: number;
  forward: StrokeMetrics;
  reverse: StrokeMetrics | null;
};

export type Evaluation = {
  verdict: Verdict;
  reasons: ErrorReason[];
  confidence: number;
  strokeMatches: StrokeMatchDetail[];
};

type PlacementCheck = {
  passed: boolean;
  quality: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function result(
  verdict: Verdict,
  reasons: ErrorReason[],
  confidence: number,
): Evaluation {
  return { verdict, reasons, confidence, strokeMatches: [] };
}

function hasFiniteAndInBoundsPoint(point: Point, tolerance: number): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= -tolerance &&
    point.x <= 1 + tolerance &&
    point.y >= -tolerance &&
    point.y <= 1 + tolerance
  );
}

function hasInvalidInput(strokes: InputStroke[], tolerance: number): boolean {
  if (strokes.length === 0) return true;

  let pointCount = 0;
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      pointCount += 1;
      if (!hasFiniteAndInBoundsPoint(point, tolerance)) return true;
    }
  }
  return pointCount === 0;
}

function orientWritingPadStrokes(strokes: InputStroke[]): InputStroke[] {
  const topOffset = HANZI_WRITER_TOP_Y / CHARACTER_SIZE;
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({
      x: point.x,
      y: topOffset - point.y,
    })),
  }));
}

function totalLength(strokes: ProcessedStroke[] | Point[][]): number {
  return strokes.reduce((sum, stroke) => {
    const points = Array.isArray(stroke) ? stroke : stroke.points;
    return sum + polylineLength(points);
  }, 0);
}

function centroid(points: Point[]): Point {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function boxArea(box: Box): number {
  return box.width * box.height;
}

function boxIntersectionSize(first: Box, second: Box): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(
      0,
      Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX),
    ),
    height: Math.max(
      0,
      Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY),
    ),
  };
}

function studentBoxOverlapRatio(student: Box, standard: Box): number {
  const studentArea = boxArea(student);
  const standardArea = boxArea(standard);
  const intersection = boxIntersectionSize(student, standard);

  if (standardArea <= EPSILON) {
    if (standard.width > EPSILON && standard.height <= EPSILON) {
      return student.width > EPSILON
        ? intersection.width / student.width
        : 0;
    }
    if (standard.height > EPSILON && standard.width <= EPSILON) {
      return student.height > EPSILON
        ? intersection.height / student.height
        : 0;
    }
  }

  if (studentArea > EPSILON) {
    return (intersection.width * intersection.height) / studentArea;
  }
  if (student.width > EPSILON && student.height <= EPSILON) {
    return intersection.width / student.width;
  }
  if (student.height > EPSILON && student.width <= EPSILON) {
    return intersection.height / student.height;
  }
  return 0;
}

function checkPlacement(
  studentStrokes: ProcessedStroke[],
  standardMedians: Point[][],
): PlacementCheck {
  const studentPoints = studentStrokes.flatMap((stroke) => stroke.points);
  const standardPoints = standardMedians.flat();
  if (studentPoints.length === 0 || standardPoints.length === 0) {
    return { passed: false, quality: 0 };
  }

  const studentCenter = centroid(studentPoints);
  const standardCenter = centroid(standardPoints);
  const centerDistance = Math.hypot(
    studentCenter.x - standardCenter.x,
    studentCenter.y - standardCenter.y,
  );

  const studentBounds = getBoundingBox(studentPoints);
  const standardBounds = getBoundingBox(standardPoints);
  const studentDiagonal = Math.hypot(studentBounds.width, studentBounds.height);
  const standardDiagonal = Math.hypot(standardBounds.width, standardBounds.height);
  const diagonalRatio =
    standardDiagonal <= EPSILON
      ? Number.POSITIVE_INFINITY
      : studentDiagonal / standardDiagonal;
  const studentOverlap = studentBoxOverlapRatio(studentBounds, standardBounds);

  const centerQuality = 1 - clamp(
    centerDistance / POSITION_CENTER_DISTANCE,
    0,
    1,
  );
  let diagonalQuality = 0;
  if (
    diagonalRatio >= POSITION_MINIMUM_DIAGONAL_RATIO &&
    diagonalRatio <= POSITION_MAXIMUM_DIAGONAL_RATIO
  ) {
    diagonalQuality = 1;
  } else if (diagonalRatio < POSITION_MINIMUM_DIAGONAL_RATIO) {
    diagonalQuality = diagonalRatio / POSITION_MINIMUM_DIAGONAL_RATIO;
  } else {
    diagonalQuality = POSITION_MAXIMUM_DIAGONAL_RATIO / diagonalRatio;
  }
  const overlapQuality = clamp(
    studentOverlap / POSITION_MINIMUM_STUDENT_OVERLAP,
    0,
    1,
  );

  return {
    passed:
      centerDistance <= POSITION_CENTER_DISTANCE &&
      diagonalRatio >= POSITION_MINIMUM_DIAGONAL_RATIO &&
      diagonalRatio <= POSITION_MAXIMUM_DIAGONAL_RATIO &&
      studentOverlap >= POSITION_MINIMUM_STUDENT_OVERLAP,
    quality: Math.min(centerQuality, diagonalQuality, overlapQuality),
  };
}

function squaredDistance(first: Point, second: Point): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy;
}

function distanceToSegment(
  point: Point,
  start: Point,
  end: Point,
): number {
  const segmentLengthSquared = squaredDistance(start, end);
  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

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

function distanceToStrokes(point: Point, strokes: Point[][]): number {
  let nearest = Number.POSITIVE_INFINITY;

  for (const stroke of strokes) {
    if (stroke.length === 1) {
      nearest = Math.min(
        nearest,
        Math.hypot(point.x - stroke[0]!.x, point.y - stroke[0]!.y),
      );
      continue;
    }

    for (let index = 1; index < stroke.length; index += 1) {
      nearest = Math.min(
        nearest,
        distanceToSegment(point, stroke[index - 1]!, stroke[index]!),
      );
    }
  }

  return nearest;
}

type DirectionDistanceProfile = {
  mean: number;
  p90: number;
  p95: number;
};

function distanceProfile(
  points: Point[],
  strokes: Point[][],
): DirectionDistanceProfile {
  const distances = points
    .map((point) => distanceToStrokes(point, strokes))
    .sort((first, second) => first - second);
  if (distances.length === 0) {
    return {
      mean: Number.POSITIVE_INFINITY,
      p90: Number.POSITIVE_INFINITY,
      p95: Number.POSITIVE_INFINITY,
    };
  }

  return {
    mean:
      distances.reduce((sum, distance) => sum + distance, 0) / distances.length,
    p90:
      distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.9))]!,
    p95:
      distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.95))]!,
  };
}

function normalizeGlyph(strokes: Point[][]): Point[][] {
  const points = strokes.flat();
  if (points.length === 0) return [];
  const bounds = getBoundingBox(points);
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const diagonal = Math.hypot(bounds.width, bounds.height);
  const scale = diagonal <= EPSILON ? 1 : 1 / diagonal;

  return strokes.map((stroke) =>
    stroke.map((point) => ({
      x: (point.x - center.x) * scale,
      y: (point.y - center.y) * scale,
    })),
  );
}

function bidirectionalInkMetrics(
  actualStrokes: ProcessedStroke[],
  expectedStrokes: Point[][],
): {
  mean: number;
  actualP90: number;
  expectedP90: number;
  actualP95: number;
  expectedP95: number;
  normalizedMean: number;
  normalizedActualP95: number;
  normalizedExpectedP95: number;
} {
  const actualPoints = actualStrokes.flatMap((stroke) => stroke.points);
  const expectedPoints = expectedStrokes.flat();
  if (actualPoints.length === 0 || expectedPoints.length === 0) {
    return {
      mean: Number.POSITIVE_INFINITY,
      actualP90: Number.POSITIVE_INFINITY,
      expectedP90: Number.POSITIVE_INFINITY,
      actualP95: Number.POSITIVE_INFINITY,
      expectedP95: Number.POSITIVE_INFINITY,
      normalizedMean: Number.POSITIVE_INFINITY,
      normalizedActualP95: Number.POSITIVE_INFINITY,
      normalizedExpectedP95: Number.POSITIVE_INFINITY,
    };
  }

  const actualToExpected = distanceProfile(actualPoints, expectedStrokes);
  const expectedToActual = distanceProfile(
    expectedPoints,
    actualStrokes.map((stroke) => stroke.points),
  );
  const normalizedActual = normalizeGlyph(
    actualStrokes.map((stroke) => stroke.points),
  );
  const normalizedExpected = normalizeGlyph(expectedStrokes);
  const normalizedActualToExpected = distanceProfile(
    normalizedActual.flat(),
    normalizedExpected,
  );
  const normalizedExpectedToActual = distanceProfile(
    normalizedExpected.flat(),
    normalizedActual,
  );

  return {
    mean: (actualToExpected.mean + expectedToActual.mean) / 2,
    actualP90: actualToExpected.p90,
    expectedP90: expectedToActual.p90,
    actualP95: actualToExpected.p95,
    expectedP95: expectedToActual.p95,
    normalizedMean:
      (normalizedActualToExpected.mean + normalizedExpectedToActual.mean) / 2,
    normalizedActualP95: normalizedActualToExpected.p95,
    normalizedExpectedP95: normalizedExpectedToActual.p95,
  };
}

export function measureGlyphMetrics(
  strokes: InputStroke[],
  characterData: CharacterFileData,
  thresholds: HandwritingThresholds = DEFAULT_THRESHOLDS,
): ReturnType<typeof bidirectionalInkMetrics> {
  const processed = preprocessStrokes(orientWritingPadStrokes(strokes), {
    size: CHARACTER_SIZE,
    minimumPointCount: thresholds.minimumPointCount,
    minimumLength: thresholds.minimumStrokeLength,
  });
  return bidirectionalInkMetrics(processed, characterData.medians);
}

function confidenceFromShape(
  inkMetrics: ReturnType<typeof bidirectionalInkMetrics>,
  placement: PlacementCheck,
  thresholds: HandwritingThresholds,
  verdict: Verdict,
): number {
  const tolerance = thresholds.meanDistance * thresholds.ambiguityRatio;
  const shapeError = Math.max(
    inkMetrics.mean,
    inkMetrics.actualP95,
    inkMetrics.expectedP95,
  );
  const shapeQuality = 1 - clamp(shapeError / Math.max(tolerance, 1), 0, 1);
  const combined = shapeQuality * 0.75 + placement.quality * 0.25;
  return clamp(verdict === "correct" ? combined : combined * 0.8, 0, 1);
}

export function evaluateCharacter(
  strokes: InputStroke[],
  characterData: CharacterFileData,
  thresholds: HandwritingThresholds = DEFAULT_THRESHOLDS,
): Evaluation {
  if (hasInvalidInput(strokes, thresholds.outOfBoundsTolerance)) {
    return result("unclear", ["ink_quality"], 0);
  }

  if (
    characterData.medians.length === 0 ||
    characterData.medians.some((median) => median.length === 0) ||
    characterData.strokes.length !== characterData.medians.length
  ) {
    return result("unclear", ["ink_quality"], 0);
  }

  const processed = preprocessStrokes(orientWritingPadStrokes(strokes), {
    size: CHARACTER_SIZE,
    minimumPointCount: thresholds.minimumPointCount,
    minimumLength: thresholds.minimumStrokeLength,
  });
  if (processed.length === 0) {
    return result("unclear", ["ink_quality"], 0);
  }

  const studentLength = totalLength(processed);
  const expectedLength = totalLength(characterData.medians);
  if (studentLength > expectedLength * thresholds.maximumInkLengthRatio) {
    return result("unclear", ["ink_quality"], 0);
  }

  const placement = checkPlacement(processed, characterData.medians);
  const inkMetrics = bidirectionalInkMetrics(processed, characterData.medians);
  const acceptableDistance =
    thresholds.meanDistance * thresholds.ambiguityRatio;
  const absoluteShapeAccepted =
    inkMetrics.actualP95 <= thresholds.shapeDistanceP95 &&
    inkMetrics.expectedP95 <= thresholds.shapeDistanceP95;
  const normalizedShapeAccepted =
    inkMetrics.normalizedActualP95 <= thresholds.normalizedShapeDistanceP95 &&
    inkMetrics.normalizedExpectedP95 <= thresholds.normalizedShapeDistanceP95;
  const shapeAccepted =
    placement.passed &&
    inkMetrics.mean <= acceptableDistance &&
    (absoluteShapeAccepted || normalizedShapeAccepted);
  const confidence = confidenceFromShape(
    inkMetrics,
    placement,
    thresholds,
    shapeAccepted ? "correct" : "incorrect",
  );

  if (shapeAccepted) {
    return result("correct", [], confidence);
  }

  return result("incorrect", ["stroke_shape"], confidence);
}
