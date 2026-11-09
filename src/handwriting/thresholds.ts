export type HandwritingThresholds = {
  meanDistance: number;
  startEndDistance: number;
  shapeDistance: number;
  minimumLengthRatio: number;
  maximumLengthRatio: number;
  minimumDirectionSimilarity: number;
  minimumPointCount: number;
  minimumStrokeLength: number;
  outOfBoundsTolerance: number;
  maximumInkLengthRatio: number;
  ambiguityRatio: number;
  minimumOrderScoreAdvantage: number;
  shapeDistanceP95: number;
  normalizedShapeDistanceP95: number;
};

export const DEFAULT_THRESHOLDS: HandwritingThresholds = {
  meanDistance: 380,
  startEndDistance: 280,
  shapeDistance: 0.48,
  minimumLengthRatio: 0.35,
  maximumLengthRatio: 2.5,
  minimumDirectionSimilarity: 0.4,
  minimumPointCount: 3,
  minimumStrokeLength: 32,
  outOfBoundsTolerance: 0.08,
  maximumInkLengthRatio: 4,
  ambiguityRatio: 1.2,
  minimumOrderScoreAdvantage: 0.12,
  shapeDistanceP95: 150,
  normalizedShapeDistanceP95: 0.06,
};
