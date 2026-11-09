import type { Point } from "../../handwriting/types";

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export function normalizePointerPoint(
  clientX: number,
  clientY: number,
  rect: RectLike,
): Point {
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

export function toSvgPath(points: Point[], size = 1024): string {
  if (points.length === 0) return "";

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x * size} ${point.y * size}`,
    )
    .join(" ");
}
