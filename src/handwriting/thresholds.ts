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
};

export const DEFAULT_THRESHOLDS: HandwritingThresholds = {
  meanDistance: 420,
  startEndDistance: 320,
  shapeDistance: 0.55,
  minimumLengthRatio: 0.35,
  maximumLengthRatio: 2.5,
  minimumDirectionSimilarity: 0.35,
  minimumPointCount: 3,
  minimumStrokeLength: 32,
  outOfBoundsTolerance: 0.08,
  maximumInkLengthRatio: 4,
  ambiguityRatio: 1.25,
  minimumOrderScoreAdvantage: 0.12,
};
