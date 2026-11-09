import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WordPracticeCharacter } from "../../content/types";
import type { InputStroke, Point } from "../../handwriting/types";
import { Button } from "../../ui/Button";
import { normalizePointerPoint, toSvgPath } from "./pointer-geometry";
import "./writing.css";

type WordWritingBoardProps = {
  characters: WordPracticeCharacter[];
  strokes: InputStroke[][];
  disabled?: boolean;
  onChange: (strokes: InputStroke[][]) => void;
  onSubmit: (strokes: InputStroke[][]) => void;
};

let fallbackStrokeSequence = 0;

function createStrokeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackStrokeSequence += 1;
  return `word-stroke-${Date.now()}-${fallbackStrokeSequence}`;
}

function capturePointer(target: HTMLDivElement, pointerId: number) {
  try {
    target.setPointerCapture?.(pointerId);
  } catch {
    // Pointer capture is an enhancement.
  }
}

function releasePointer(target: HTMLDivElement, pointerId: number) {
  try {
    target.releasePointerCapture?.(pointerId);
  } catch {
    // Synthetic pointers and older WebKit may not own capture.
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

export function WordWritingBoard({
  characters,
  strokes,
  disabled = false,
  onChange,
  onSubmit,
}: WordWritingBoardProps) {
  const strokesRef = useRef(strokes);
  const activePointerRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<string | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  strokesRef.current = strokes;

  function updateStrokes(next: InputStroke[][]) {
    strokesRef.current = next;
    onChange(next);
  }

  function finishPointer(
    event: ReactPointerEvent<HTMLDivElement>,
    removeUnfinished = false,
  ) {
    if (event.pointerId !== activePointerRef.current) return false;
    releasePointer(event.currentTarget, event.pointerId);
    const index = activeIndexRef.current;
    const strokeId = activeStrokeRef.current;
    activePointerRef.current = null;
    activeStrokeRef.current = null;
    activeIndexRef.current = null;

    if (removeUnfinished && index !== null && strokeId) {
      updateStrokes(
        strokesRef.current.map((entry, entryIndex) =>
          entryIndex === index
            ? entry.filter((stroke) => stroke.id !== strokeId)
            : entry,
        ),
      );
    }
    return true;
  }

  function handlePointerDown(
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (disabled || activePointerRef.current !== null) return;
    event.preventDefault();
    const id = createStrokeId();
    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = id;
    activeIndexRef.current = index;
    capturePointer(event.currentTarget, event.pointerId);
    updateStrokes(
      strokesRef.current.map((entry, entryIndex) =>
        entryIndex === index
          ? [...entry, { id, points: [pointerPoint(event, event.currentTarget)] }]
          : entry,
      ),
    );
  }

  function handlePointerMove(
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      disabled ||
      event.pointerId !== activePointerRef.current ||
      index !== activeIndexRef.current
    ) {
      return;
    }
    const id = activeStrokeRef.current;
    if (!id) return;
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const samples = coalesced && coalesced.length > 0 ? coalesced : [event.nativeEvent];
    const added = samples.map((sample) =>
      pointerPoint(sample, event.currentTarget),
    );
    updateStrokes(
      strokesRef.current.map((entry, entryIndex) =>
        entryIndex === index
          ? entry.map((stroke) =>
              stroke.id === id
                ? { ...stroke, points: [...stroke.points, ...added] }
                : stroke,
            )
          : entry,
      ),
    );
  }

  function handlePointerUp(
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      disabled ||
      event.pointerId !== activePointerRef.current ||
      index !== activeIndexRef.current
    ) {
      return;
    }
    const id = activeStrokeRef.current;
    if (id) {
      const point = pointerPoint(event, event.currentTarget);
      updateStrokes(
        strokesRef.current.map((entry, entryIndex) =>
          entryIndex === index
            ? entry.map((stroke) =>
                stroke.id === id
                  ? { ...stroke, points: [...stroke.points, point] }
                  : stroke,
              )
            : entry,
        ),
      );
    }
    finishPointer(event);
  }

  const complete = strokes.length === characters.length &&
    strokes.every((entry) => entry.length > 0);

  return (
    <section
      className="writing-word-board"
      aria-label="词语手写练习"
      data-disabled={disabled ? "true" : undefined}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="writing-board-hint">请按拼音在田字格中书写词语</p>
      <div
        className={`writing-word-board__grid writing-word-board__grid--${Math.min(characters.length, 4)}`}
        style={{ "--word-size": characters.length } as CSSProperties}
      >
        {characters.map((character, index) => (
          <div className="writing-word-board__cell" key={`${character.char}-${index}`}>
            <p className="writing-word-board__pinyin">{character.pinyin}</p>
            <div
              className="writing-board writing-word-board__pad"
              data-testid={`writing-board-${index}`}
              role="group"
              aria-label={`第 ${index + 1} 个田字格，拼音 ${character.pinyin}`}
              aria-disabled={disabled || undefined}
              onPointerDown={(event) => handlePointerDown(index, event)}
              onPointerMove={(event) => handlePointerMove(index, event)}
              onPointerUp={(event) => handlePointerUp(index, event)}
              onPointerCancel={(event) => finishPointer(event, true)}
            >
              <svg
                className="writing-board__svg"
                viewBox="0 0 1024 1024"
                aria-hidden="true"
              >
                {strokes[index]?.map((stroke) => (
                  <path key={stroke.id} d={toSvgPath(stroke.points)} />
                ))}
              </svg>
            </div>
          </div>
        ))}
      </div>
      <div className="writing-word-board__actions">
        <Button
          variant="secondary"
          disabled={disabled || !strokes.some((entry) => entry.length > 0)}
          onClick={() => onChange(characters.map(() => []))}
        >
          清空重写
        </Button>
        <Button
          disabled={disabled || !complete}
          onClick={() => onSubmit(strokes.map((entry) => [...entry]))}
        >
          提交
        </Button>
      </div>
    </section>
  );
}
