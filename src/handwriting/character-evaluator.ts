import { getBoundingBox, polylineLength, preprocessStrokes } from "./preprocess";
import { matchStroke, type StrokeMetrics } from "./stroke-matcher";
import {
  DEFAULT_THRESHOLDS,
  type HandwritingThresholds,
} from "./thresholds";
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
const ASSIGNMENT_FORBIDDEN = -1_000_000;

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

type StrokeMatchMatrix = ReturnType<typeof matchStroke>[][];

type PlacementCheck = {
  passed: boolean;
  quality: number;
  centerDistance: number;
  diagonalRatio: number;
  studentOverlap: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function result(
  verdict: Verdict,
  reasons: ErrorReason[],
  confidence: number,
  strokeMatches: StrokeMatchDetail[] = [],
): Evaluation {
  return { verdict, reasons, confidence, strokeMatches };
}

function cloneMetrics(metrics: StrokeMetrics): StrokeMetrics {
  return { ...metrics };
}

function summarizeMatch(
  actualIndex: number,
  expectedIndex: number,
  match: ReturnType<typeof matchStroke>,
): StrokeMatchDetail {
  return {
    actualIndex,
    expectedIndex,
    matched: match.matched,
    reverseMatched: match.reverseMatched,
    score: match.forward.score,
    forward: cloneMetrics(match.forward),
    reverse: match.reverse ? cloneMetrics(match.reverse) : null,
  };
}

function hasFiniteAndInBoundsPoint(
  point: Point,
  tolerance: number,
): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= -tolerance &&
    point.x <= 1 + tolerance &&
    point.y >= -tolerance &&
    point.y <= 1 + tolerance
  );
}

function hasInvalidInput(
  strokes: InputStroke[],
  tolerance: number,
): boolean {
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

function maximumAssignmentScore(weights: number[][]): number | null {
  const size = weights.length;
  if (size === 0) return 0;
  if (weights.some((row) => row.every((value) => !Number.isFinite(value)))) {
    return null;
  }
  const normalizedWeights = weights.map((row) =>
    row.map((value) =>
      Number.isFinite(value) ? value : ASSIGNMENT_FORBIDDEN,
    ),
  );

  const rowPotential = Array.from({ length: size + 1 }, () => 0);
  const columnPotential = Array.from({ length: size + 1 }, () => 0);
  const columnMatch = Array.from({ length: size + 1 }, () => 0);
  const previousColumn = Array.from({ length: size + 1 }, () => 0);

  for (let row = 1; row <= size; row += 1) {
    columnMatch[0] = row;
    let currentColumn = 0;
    const minimum = Array.from({ length: size + 1 }, () =>
      Number.POSITIVE_INFINITY,
    );
    const used = Array.from({ length: size + 1 }, () => false);

    do {
      used[currentColumn] = true;
      const currentRow = columnMatch[currentColumn]!;
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;

      for (let column = 1; column <= size; column += 1) {
        if (used[column]) continue;
        const reducedCost =
          -normalizedWeights[currentRow - 1]![column - 1]! -
          rowPotential[currentRow]! -
          columnPotential[column]!;
        if (reducedCost < minimum[column]!) {
          minimum[column] = reducedCost;
          previousColumn[column] = currentColumn;
        }
        if (minimum[column]! < delta) {
          delta = minimum[column]!;
          nextColumn = column;
        }
      }

      if (!Number.isFinite(delta)) return null;
      for (let column = 0; column <= size; column += 1) {
        if (used[column]) {
          const matchedRow = columnMatch[column]!;
          rowPotential[matchedRow] = rowPotential[matchedRow]! + delta;
          columnPotential[column] = columnPotential[column]! - delta;
        } else {
          minimum[column] = minimum[column]! - delta;
        }
      }
      currentColumn = nextColumn;
    } while (columnMatch[currentColumn] !== 0);

    do {
      const nextColumn = previousColumn[currentColumn]!;
      columnMatch[currentColumn] = columnMatch[nextColumn]!;
      currentColumn = nextColumn;
    } while (currentColumn !== 0);
  }

  const assignment = Array.from({ length: size }, () => 0);
  for (let column = 1; column <= size; column += 1) {
    assignment[columnMatch[column]! - 1] = column - 1;
  }
  const score = assignment.reduce(
    (sum, column, row) => sum + normalizedWeights[row]![column]!,
    0,
  );
  return score <= ASSIGNMENT_FORBIDDEN / 2 ? null : score;
}

function bestNonIdentityAssignmentScore(
  matches: StrokeMatchMatrix,
): number | null {
  const strokeCount = matches.length;
  if (strokeCount < 2 || matches.some((row) => row.length !== strokeCount)) {
    return null;
  }

  const weights = matches.map((row) =>
    row.map((match) =>
      match.matched ? match.forward.score : Number.NEGATIVE_INFINITY,
    ),
  );
  let best: number | null = null;

  for (let actualIndex = 0; actualIndex < strokeCount; actualIndex += 1) {
    for (let expectedIndex = 0; expectedIndex < strokeCount; expectedIndex += 1) {
      if (
        actualIndex === expectedIndex ||
        !matches[actualIndex]![expectedIndex]!.matched
      ) {
        continue;
      }

      const remainingRows = Array.from(
        { length: strokeCount },
        (_, index) => index,
      ).filter((index) => index !== actualIndex);
      const remainingColumns = Array.from(
        { length: strokeCount },
        (_, index) => index,
      ).filter((index) => index !== expectedIndex);
      const remainingWeights = remainingRows.map((row) =>
        remainingColumns.map((column) => weights[row]![column]!),
      );
      const remainingScore = maximumAssignmentScore(remainingWeights);
      if (remainingScore === null) continue;

      const total =
        matches[actualIndex]![expectedIndex]!.forward.score + remainingScore;
      best = best === null ? total : Math.max(best, total);
    }
  }

  return best;
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
    return {
      passed: false,
      quality: 0,
      centerDistance: Number.POSITIVE_INFINITY,
      diagonalRatio: 0,
      studentOverlap: 0,
    };
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
  if (diagonalRatio >= POSITION_MINIMUM_DIAGONAL_RATIO &&
      diagonalRatio <= POSITION_MAXIMUM_DIAGONAL_RATIO) {
    diagonalQuality = 1;
  } else if (diagonalRatio < POSITION_MINIMUM_DIAGONAL_RATIO) {
    diagonalQuality =
      diagonalRatio / POSITION_MINIMUM_DIAGONAL_RATIO;
  } else {
    diagonalQuality =
      POSITION_MAXIMUM_DIAGONAL_RATIO / diagonalRatio;
  }
  const overlapQuality = clamp(
    studentOverlap / POSITION_MINIMUM_STUDENT_OVERLAP,
    0,
    1,
  );

  const passed =
    centerDistance <= POSITION_CENTER_DISTANCE &&
    diagonalRatio >= POSITION_MINIMUM_DIAGONAL_RATIO &&
    diagonalRatio <= POSITION_MAXIMUM_DIAGONAL_RATIO &&
    studentOverlap >= POSITION_MINIMUM_STUDENT_OVERLAP;

  return {
    passed,
    quality: Math.min(centerQuality, diagonalQuality, overlapQuality),
    centerDistance,
    diagonalRatio,
    studentOverlap,
  };
}

function metricsWithinAmbiguity(
  metrics: StrokeMetrics,
  thresholds: HandwritingThresholds,
): boolean {
  const ratio = thresholds.ambiguityRatio;
  return (
    metrics.meanDistance <= thresholds.meanDistance * ratio &&
    metrics.startDistance <= thresholds.startEndDistance * ratio &&
    metrics.endDistance <= thresholds.startEndDistance * ratio &&
    metrics.shapeDistance <= thresholds.shapeDistance * ratio &&
    metrics.lengthRatio >= thresholds.minimumLengthRatio / ratio &&
    metrics.lengthRatio <= thresholds.maximumLengthRatio * ratio &&
    metrics.directionSimilarity >= thresholds.minimumDirectionSimilarity / ratio
  );
}

function calculateConfidence(
  identityMatches: Array<ReturnType<typeof matchStroke> | undefined>,
  actualCount: number,
  expectedCount: number,
  placement: PlacementCheck | null,
  reason: ErrorReason | null,
): number {
  const denominator = Math.max(actualCount, expectedCount, 1);
  const scoreSum = identityMatches.reduce(
    (sum, match) => sum + (match?.forward.score ?? 0),
    0,
  );
  const averageScore = scoreSum / denominator;
  const countRatio =
    Math.min(actualCount, expectedCount) / Math.max(actualCount, expectedCount, 1);
  const placementFactor = placement?.quality ?? 0.45;
  const reasonFactor: Record<ErrorReason, number> = {
    stroke_count: 0.55,
    stroke_shape: 0.65,
    stroke_order: 0.7,
    stroke_direction: 0.7,
    ink_quality: 0.35,
  };

  return clamp(
    averageScore *
      countRatio *
      placementFactor *
      (reason ? reasonFactor[reason] : 1),
    0,
    1,
  );
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

  const matches: StrokeMatchMatrix = processed.map((stroke) =>
    characterData.medians.map((median) =>
      matchStroke(stroke.points, median, thresholds),
    ),
  );
  const identityMatches = matches.map((row, index) => row[index]);
  const averageIdentityMatches = identityMatches.filter(
    (match): match is ReturnType<typeof matchStroke> => Boolean(match),
  );

  const studentLength = totalLength(processed);
  const expectedLength = totalLength(characterData.medians);
  const anySameIndexForwardMatch = identityMatches.some(
    (match) => match?.matched === true,
  );

  if (
    studentLength >
      expectedLength * thresholds.maximumInkLengthRatio &&
    !anySameIndexForwardMatch
  ) {
    return result(
      "unclear",
      ["ink_quality"],
      calculateConfidence(
        identityMatches,
        processed.length,
        characterData.medians.length,
        null,
        "ink_quality",
      ),
    );
  }

  if (processed.length !== characterData.medians.length) {
    return result(
      "incorrect",
      ["stroke_count"],
      calculateConfidence(
        identityMatches,
        processed.length,
        characterData.medians.length,
        null,
        "stroke_count",
      ),
      matches
        .slice(0, characterData.medians.length)
        .map((row, index) => summarizeMatch(index, index, row[index]!)),
    );
  }

  const strokeMatches = matches.map((row, index) =>
    summarizeMatch(index, index, row[index]!),
  );

  const allForwardMatched = identityMatches.every(
    (match) => match?.matched === true,
  );
  const identityScore = identityMatches.reduce(
    (sum, match) => sum + match!.forward.score,
    0,
  );
  const nonIdentityScore = allForwardMatched
    ? null
    : bestNonIdentityAssignmentScore(matches);
  if (
    nonIdentityScore !== null &&
    nonIdentityScore >= identityScore + thresholds.minimumOrderScoreAdvantage
  ) {
    return result(
      "incorrect",
      ["stroke_order"],
      calculateConfidence(
        identityMatches,
        processed.length,
        characterData.medians.length,
        null,
        "stroke_order",
      ),
      strokeMatches,
    );
  }

  if (identityMatches.some((match) => match?.reverseMatched === true)) {
    return result(
      "incorrect",
      ["stroke_direction"],
      calculateConfidence(
        identityMatches,
        processed.length,
        characterData.medians.length,
        null,
        "stroke_direction",
      ),
      strokeMatches,
    );
  }

  if (allForwardMatched) {
    const placement = checkPlacement(processed, characterData.medians);
    if (placement.passed) {
      return result(
        "correct",
        [],
        calculateConfidence(
          averageIdentityMatches,
          processed.length,
          characterData.medians.length,
          placement,
          null,
        ),
        strokeMatches,
      );
    }

    return result(
      "incorrect",
      ["stroke_shape"],
      calculateConfidence(
        identityMatches,
        processed.length,
        characterData.medians.length,
        placement,
        "stroke_shape",
      ),
      strokeMatches,
    );
  }

  const allNearMisses = identityMatches.every(
    (match) =>
      match?.matched === true ||
      metricsWithinAmbiguity(match!.forward, thresholds),
  );
  if (allNearMisses) {
    return result(
      "unclear",
      ["ink_quality"],
      calculateConfidence(
        identityMatches,
        processed.length,
        characterData.medians.length,
        null,
        "ink_quality",
      ),
      strokeMatches,
    );
  }

  return result(
    "incorrect",
    ["stroke_shape"],
    calculateConfidence(
      identityMatches,
      processed.length,
      characterData.medians.length,
      null,
      "stroke_shape",
    ),
    strokeMatches,
  );
}
