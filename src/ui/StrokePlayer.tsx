import { useEffect, useLayoutEffect, useRef, useState } from "react";
import HanziWriter, { type CharacterJson } from "hanzi-writer";
import type { CharacterFileData } from "../handwriting/types";

export type StrokePlayerCreate = typeof HanziWriter.create;

type StrokePlayerProps = {
  char: string;
  characterData: CharacterFileData;
  autoPlay?: boolean;
  createWriter?: StrokePlayerCreate;
};

type PlaybackStatus = "idle" | "playing" | "complete";

const fallbackSize = 320;
const maxSize = 640;
const playbackFallbackMs = 30000;

function displaySize(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return fallbackSize;
  }
  return Math.min(Math.round(containerWidth), maxSize);
}

function toCharacterJson(characterData: CharacterFileData): CharacterJson {
  return {
    strokes: [...characterData.strokes],
    medians: characterData.medians.map((median) =>
      median.map((point) => [point.x, point.y]),
    ),
  };
}

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function StrokePlayer({
  char,
  characterData,
  autoPlay = false,
  createWriter,
}: StrokePlayerProps) {
  const containerRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackIdRef = useRef(0);
  const statusRef = useRef<PlaybackStatus>("idle");
  const autoPlayedRef = useRef(false);
  const sourceRef = useRef<{
    char: string;
    characterData: CharacterFileData;
    createWriter: StrokePlayerCreate;
  } | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [ready, setReady] = useState(false);
  const [prefersReducedMotion] = useState(systemPrefersReducedMotion);

  function updateStatus(nextStatus: PlaybackStatus) {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }

  function clearPlaybackTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function finishPlayback(playbackId: number) {
    if (playbackId !== playbackIdRef.current) return;
    clearPlaybackTimer();
    updateStatus("complete");
  }

  function startPlayback(writer = writerRef.current) {
    if (!writer) return;

    const playbackId = ++playbackIdRef.current;
    clearPlaybackTimer();
    updateStatus("playing");

    try {
      const animation = writer.animateCharacter({
        onComplete: () => finishPlayback(playbackId),
      });
      if (animation && typeof animation.then === "function") {
        void Promise.resolve(animation).then(
          () => finishPlayback(playbackId),
          () => finishPlayback(playbackId),
        );
      } else {
        timerRef.current = setTimeout(
          () => finishPlayback(playbackId),
          playbackFallbackMs,
        );
      }
    } catch {
      finishPlayback(playbackId);
    }
  }

  function scheduleAutoPlay(writer: HanziWriter) {
    queueMicrotask(() => {
      if (writerRef.current !== writer || autoPlayedRef.current) return;
      autoPlayedRef.current = true;

      if (prefersReducedMotion && typeof writer.showCharacter === "function") {
        try {
          writer.showCharacter({ duration: 0 });
        } catch {
          startPlayback(writer);
        }
        return;
      }

      startPlayback(writer);
    });
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = (width: number) => {
      const nextSize = displaySize(width);
      setSize((current) => (current === nextSize ? current : nextSize));
    };

    measure(container.getBoundingClientRect().width || container.clientWidth);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measuredWidth =
      containerRef.current?.getBoundingClientRect().width ||
      containerRef.current?.clientWidth ||
      0;
    const writerSize = displaySize(measuredWidth);

    const writerFactory = createWriter ?? HanziWriter.create;
    const sourceChanged =
      sourceRef.current?.char !== char ||
      sourceRef.current.characterData !== characterData ||
      sourceRef.current.createWriter !== writerFactory;
    sourceRef.current = {
      char,
      characterData,
      createWriter: writerFactory,
    };
    if (sourceChanged) {
      autoPlayedRef.current = false;
      updateStatus("idle");
    } else if (statusRef.current === "playing") {
      updateStatus("idle");
    }

    const options = {
      width: writerSize,
      height: writerSize,
      padding: 8,
      showOutline: false,
      showCharacter: false,
      showHintAfterMisses: false as const,
      strokeColor: "#7B4051",
      ...(prefersReducedMotion
        ? {
            strokeAnimationSpeed: 8,
            strokeFadeDuration: 0,
            delayBetweenStrokes: 0,
          }
        : {}),
      charDataLoader: (
        _requestedChar: string,
        onComplete: (data: CharacterJson) => void,
      ) => {
        onComplete(toCharacterJson(characterData));
      },
    };
    const writer = writerFactory(host, char, options);
    writerRef.current = writer;
    setReady(true);

    if (autoPlay) scheduleAutoPlay(writer);

    return () => {
      playbackIdRef.current += 1;
      clearPlaybackTimer();
      setReady(false);
      if (writerRef.current === writer) writerRef.current = null;

      try {
        if (typeof writer.cancelQuiz === "function") writer.cancelQuiz();
      } catch {
        // Cleanup should not prevent the rest of the writer teardown.
      }
      try {
        if (typeof writer.hideCharacter === "function") writer.hideCharacter();
      } catch {
        // Cleanup should not prevent clearing the rendered host.
      }
      host.replaceChildren();
    };
  }, [
    autoPlay,
    char,
    characterData,
    createWriter,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    if (size === null || !writerRef.current) return;

    try {
      writerRef.current.updateDimensions({ width: size, height: size });
    } catch {
      // A non-resizable test double can keep its original dimensions.
    }
  }, [size]);

  useEffect(
    () => () => {
      playbackIdRef.current += 1;
      clearPlaybackTimer();
    },
    [],
  );

  const buttonLabel =
    status === "playing"
      ? "播放中…"
      : status === "complete"
        ? "重播笔顺"
        : "播放笔顺";

  return (
    <section
      ref={containerRef}
      className="stroke-player"
      aria-label={`“${char}”的标准笔顺动画`}
    >
      <div ref={hostRef} className="stroke-player__canvas" />
      <div className="stroke-player__actions">
        <button
          className="button button-secondary"
          type="button"
          disabled={!ready || status === "playing"}
          onClick={() => startPlayback()}
        >
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}
