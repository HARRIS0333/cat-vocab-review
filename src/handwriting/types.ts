export type Point = { x: number; y: number };

export type CharacterFileData = {
  strokes: string[];
  medians: Point[][];
};

export type Box = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type InputStroke = { id: string; points: Point[] };

export type ProcessedStroke = {
  id: string;
  points: Point[];
  length: number;
  bounds: Box;
};
