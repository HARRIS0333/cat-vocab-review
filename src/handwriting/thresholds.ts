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
};

export const DEFAULT_THRESHOLDS: HandwritingThresholds = {
  meanDistance: 350,
  startEndDistance: 250,
  shapeDistance: 0.4,
  minimumLengthRatio: 0.35,
  maximumLengthRatio: 2.5,
  minimumDirectionSimilarity: 0.5,
  minimumPointCount: 3,
  minimumStrokeLength: 32,
  outOfBoundsTolerance: 0.08,
  maximumInkLengthRatio: 4,
  ambiguityRatio: 1.15,
};
