import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import uiCss from "./ui.css?raw";
import { StrokePlayer, type StrokePlayerCreate } from "./StrokePlayer";

const data = {
  strokes: ["M 100 500 L 900 500", "M 500 100 L 500 900"],
  medians: [
    [
      { x: 100, y: 500 },
      { x: 900, y: 500 },
    ],
    [
      { x: 500, y: 100 },
      { x: 500, y: 900 },
    ],
  ],
};

type WriterStub = {
  animateCharacter: ReturnType<typeof vi.fn>;
  cancelQuiz?: ReturnType<typeof vi.fn>;
  hideCharacter?: ReturnType<typeof vi.fn>;
  showCharacter?: ReturnType<typeof vi.fn>;
};

function setupWriter(writer: WriterStub = { animateCharacter: vi.fn() }) {
  const createWriter = vi.fn(() => writer) as unknown as StrokePlayerCreate;
  return { writer, createWriter };
}

function writerCalls(createWriter: StrokePlayerCreate) {
  return vi.mocked(createWriter).mock.calls;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("loads only passed-in local character data and configures a hidden standard animation", async () => {
  const { writer, createWriter } = setupWriter();
  render(
    <StrokePlayer
      char="十"
      characterData={data}
      autoPlay
      createWriter={createWriter}
    />,
  );

  await waitFor(() => expect(createWriter).toHaveBeenCalledTimes(1));
  expect(
    screen.getByRole("region", { name: "“十”的标准笔顺动画" }),
  ).toBeInTheDocument();

  const options = writerCalls(createWriter)[0]?.[2];
  expect(options).toMatchObject({
    showOutline: false,
    showCharacter: false,
    showHintAfterMisses: false,
    padding: 8,
    strokeColor: "#7B4051",
  });

  let loaded: { strokes: string[]; medians: number[][][] } | undefined;
  options?.charDataLoader?.(
    "十",
    (next) => {
      loaded = next;
    },
    vi.fn(),
  );
  expect(loaded).toEqual({
    strokes: data.strokes,
    medians: [
      [[100, 500], [900, 500]],
      [[500, 100], [500, 900]],
    ],
  });
  await waitFor(() =>
    expect(writer.animateCharacter).toHaveBeenCalledTimes(1),
  );
});

it("shows playback state, then offers a replay without creating another writer", async () => {
  let complete: (() => void) | undefined;
  const writer: WriterStub = {
    animateCharacter: vi.fn((options?: { onComplete?: () => void }) => {
      complete = options?.onComplete;
    }),
  };
  const { createWriter } = setupWriter(writer);
  render(
    <StrokePlayer char="十" characterData={data} createWriter={createWriter} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "播放笔顺" }));

  expect(screen.getByRole("button", { name: "播放中…" })).toBeDisabled();
  expect(writer.animateCharacter).toHaveBeenCalledTimes(1);

  act(() => complete?.());

  const replay = screen.getByRole("button", { name: "重播笔顺" });
  expect(replay).toBeEnabled();
  fireEvent.click(replay);

  expect(writer.animateCharacter).toHaveBeenCalledTimes(2);
  expect(createWriter).toHaveBeenCalledTimes(1);
});

it("waits for the real completion callback instead of ending at five seconds", () => {
  vi.useFakeTimers();
  let complete: (() => void) | undefined;
  const writer: WriterStub = {
    animateCharacter: vi.fn((options?: { onComplete?: () => void }) => {
      complete = options?.onComplete;
    }),
  };
  const { createWriter } = setupWriter(writer);
  render(
    <StrokePlayer char="十" characterData={data} createWriter={createWriter} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "播放笔顺" }));
  act(() => vi.advanceTimersByTime(6000));

  expect(screen.getByRole("button", { name: "播放中…" })).toBeDisabled();
  act(() => complete?.());
  expect(screen.getByRole("button", { name: "重播笔顺" })).toBeEnabled();
});

it("recovers the playback button with a long fallback when no completion arrives", () => {
  vi.useFakeTimers();
  const { writer, createWriter } = setupWriter();
  render(
    <StrokePlayer char="十" characterData={data} createWriter={createWriter} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "播放笔顺" }));
  expect(screen.getByRole("button", { name: "播放中…" })).toBeDisabled();

  act(() => vi.advanceTimersByTime(30000));

  expect(screen.getByRole("button", { name: "重播笔顺" })).toBeEnabled();
  expect(writer.animateCharacter).toHaveBeenCalledTimes(1);
});

it("does not replay autoplay when only its container size changes", async () => {
  let resize: ResizeObserverCallback | undefined;

  class ResizeObserverStub implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = callback;
    }

    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  const { writer, createWriter } = setupWriter();
  render(
    <StrokePlayer
      char="十"
      characterData={data}
      autoPlay
      createWriter={createWriter}
    />,
  );

  await waitFor(() =>
    expect(writer.animateCharacter).toHaveBeenCalledTimes(1),
  );
  const canvas = screen.getByRole("region", {
    name: "“十”的标准笔顺动画",
  }).firstElementChild;

  act(() => {
    resize?.(
      [
        {
          target: canvas as Element,
          contentRect: { width: 640 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
  });

  await waitFor(() => expect(createWriter).toHaveBeenCalledTimes(2));
  expect(writer.animateCharacter).toHaveBeenCalledTimes(1);
});

it("starts StrictMode autoplay exactly once", async () => {
  const { writer, createWriter } = setupWriter();
  render(
    <StrictMode>
      <StrokePlayer
        char="十"
        characterData={data}
        autoPlay
        createWriter={createWriter}
      />
    </StrictMode>,
  );

  await waitFor(() =>
    expect(writer.animateCharacter).toHaveBeenCalledTimes(1),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(writer.animateCharacter).toHaveBeenCalledTimes(1);
});

it("suppresses automatic JavaScript animation for reduced motion", async () => {
  const matchMedia = vi.fn().mockReturnValue({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal("matchMedia", matchMedia);
  const writer: WriterStub = {
    animateCharacter: vi.fn(),
    showCharacter: vi.fn(),
  };
  const { createWriter } = setupWriter(writer);

  render(
    <StrokePlayer
      char="十"
      characterData={data}
      autoPlay
      createWriter={createWriter}
    />,
  );

  await waitFor(() => expect(writer.showCharacter).toHaveBeenCalledWith({ duration: 0 }));
  expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  expect(writer.animateCharacter).not.toHaveBeenCalled();
});

it("rebuilds a square writer capped at 640 pixels when its container resizes", async () => {
  let resize: ResizeObserverCallback | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();

  class ResizeObserverStub implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = callback;
    }

    observe = observe;
    unobserve = vi.fn();
    disconnect = disconnect;
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  const { createWriter } = setupWriter();
  render(
    <StrokePlayer char="十" characterData={data} createWriter={createWriter} />,
  );

  await waitFor(() => expect(observe).toHaveBeenCalledTimes(1));
  const host = screen.getByRole("region", {
    name: "“十”的标准笔顺动画",
  }).firstElementChild;

  act(() => {
    resize?.(
      [
        {
          target: host as Element,
          contentRect: { width: 900 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
  });

  await waitFor(() => expect(createWriter).toHaveBeenCalledTimes(2));
  expect(writerCalls(createWriter)[1]?.[2]).toMatchObject({
    width: 640,
    height: 640,
  });
});

it("cancels, clears its host, disconnects observation, and clears timers on unmount", () => {
  vi.useFakeTimers();
  const writer: WriterStub = {
    animateCharacter: vi.fn(),
    cancelQuiz: vi.fn(),
    hideCharacter: vi.fn(),
  };
  const { createWriter } = setupWriter(writer);
  const disconnect = vi.fn();

  class ResizeObserverStub implements ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = disconnect;
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);

  const { unmount } = render(
    <StrokePlayer char="十" characterData={data} createWriter={createWriter} />,
  );
  expect(createWriter).toHaveBeenCalledTimes(1);

  const host = writerCalls(createWriter)[0]?.[0] as HTMLElement;
  host.innerHTML = "<svg data-testid=\"writer\"></svg>";
  fireEvent.click(screen.getByRole("button", { name: "播放笔顺" }));

  unmount();

  expect(writer.cancelQuiz).toHaveBeenCalledTimes(1);
  expect(writer.hideCharacter).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(host).toBeEmptyDOMElement();
  expect(vi.getTimerCount()).toBe(0);
});

it("defines responsive player classes and a real touch target", () => {
  expect(uiCss).toMatch(/\.stroke-player\s*\{/);
  expect(uiCss).toMatch(/\.stroke-player__canvas\s*\{/);
  expect(uiCss).toMatch(/\.stroke-player__actions\s*\{/);

  const actionsRule = uiCss.match(
    /\.stroke-player__actions\s*\{([^}]+)\}/,
  )?.[1];
  expect(actionsRule).toMatch(/min-height:\s*44px/);
});
