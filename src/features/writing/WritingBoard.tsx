import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { InputStroke, Point } from "../../handwriting/types";
import { Button } from "../../ui/Button";
import { normalizePointerPoint, toSvgPath } from "./pointer-geometry";
import "./writing.css";

export type WritingBoardProps = {
  strokes: InputStroke[];
  disabled?: boolean;
  onChange: (strokes: InputStroke[]) => void;
  onSubmit: (strokes: InputStroke[]) => void;
};

let fallbackStrokeSequence = 0;

function createStrokeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  fallbackStrokeSequence += 1;
  return `stroke-${Date.now()}-${fallbackStrokeSequence}`;
}

function capturePointer(target: HTMLDivElement, pointerId: number) {
  const capture = target.setPointerCapture;
  if (typeof capture !== "function") return;

  try {
    capture.call(target, pointerId);
  } catch {
    // Pointer capture is an enhancement; writing still works without it.
  }
}

function releasePointer(target: HTMLDivElement, pointerId: number) {
  const release = target.releasePointerCapture;
  if (typeof release !== "function") return;

  try {
    release.call(target, pointerId);
  } catch {
    // Older WebKit and synthetic test pointers may not own a capture.
  }
}

function pointerPoint(
  event: ReactPointerEvent<HTMLDivElement> | PointerEvent,
  board: HTMLDivElement,
): Point {
  return normalizePointerPoint(
    event.clientX,
    event.clientY,
    board.getBoundingClientRect(),
  );
}

export function WritingBoard({
  strokes,
  disabled = false,
  onChange,
  onSubmit,
}: WritingBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef(strokes);
  const activePointerRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<string | null>(null);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  function updateStrokes(next: InputStroke[]) {
    strokesRef.current = next;
    onChange(next);
  }

  useEffect(() => {
    if (!disabled) return;

    const pointerId = activePointerRef.current;
    const strokeId = activeStrokeRef.current;
    if (pointerId === null && strokeId === null) return;

    if (pointerId !== null && boardRef.current) {
      releasePointer(boardRef.current, pointerId);
    }
    activePointerRef.current = null;
    activeStrokeRef.current = null;

    if (strokeId !== null) {
      const remaining = strokesRef.current.filter((stroke) => stroke.id !== strokeId);
      strokesRef.current = remaining;
      onChange(remaining);
    }
  }, [disabled, onChange]);

  function finishActivePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerId !== activePointerRef.current) return false;

    releasePointer(event.currentTarget, event.pointerId);
    activePointerRef.current = null;
    activeStrokeRef.current = null;
    return true;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || activePointerRef.current !== null) return;

    event.preventDefault();
    activePointerRef.current = event.pointerId;
    const id = createStrokeId();
    activeStrokeRef.current = id;
    capturePointer(event.currentTarget, event.pointerId);
    updateStrokes([
      ...strokesRef.current,
      { id, points: [pointerPoint(event, event.currentTarget)] },
    ]);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerId !== activePointerRef.current) return;

    const id = activeStrokeRef.current;
    if (!id) return;

    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const samples = coalesced && coalesced.length > 0
      ? coalesced
      : [event.nativeEvent];
    const added = samples.map((sample) =>
      pointerPoint(sample, event.currentTarget),
    );

    updateStrokes(
      strokesRef.current.map((stroke) =>
        stroke.id === id
          ? { ...stroke, points: [...stroke.points, ...added] }
          : stroke,
      ),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerId !== activePointerRef.current) return;

    const id = activeStrokeRef.current;
    if (id) {
      const point = pointerPoint(event, event.currentTarget);
      updateStrokes(
        strokesRef.current.map((stroke) =>
          stroke.id === id
            ? { ...stroke, points: [...stroke.points, point] }
            : stroke,
        ),
      );
    }

    finishActivePointer(event);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const id = activeStrokeRef.current;
    if (!finishActivePointer(event) || !id) return;

    updateStrokes(strokesRef.current.filter((stroke) => stroke.id !== id));
  }

  return (
    <section
      className="writing-board-panel"
      aria-label="手写练习"
      data-disabled={disabled ? "true" : undefined}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="writing-board-hint">请按笔顺在田字格中书写</p>
      <div
        ref={boardRef}
        data-testid="writing-board"
        className="writing-board"
        role="group"
        aria-label="手写田字格，可手指或触控笔书写"
        aria-disabled={disabled || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <svg
          className="writing-board__svg"
          viewBox="0 0 1024 1024"
          aria-hidden="true"
        >
          {strokes.map((stroke) => (
            <path key={stroke.id} d={toSvgPath(stroke.points)} />
          ))}
        </svg>
      </div>
      <div className="writing-board-actions">
        <Button
          variant="secondary"
          disabled={disabled || strokes.length === 0}
          onClick={() => onChange([])}
        >
          清空重写
        </Button>
        <Button
          disabled={disabled || strokes.length === 0}
          onClick={() => onSubmit([...strokes])}
        >
          提交
        </Button>
      </div>
    </section>
  );
}
