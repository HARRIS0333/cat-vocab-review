import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InputStroke } from "../../handwriting/types";
import { WritingBoard } from "./WritingBoard";
import css from "./writing.css?raw";

function boardRect(width = 400, height = 400): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  };
}

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    boardRect(),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({
  initialStrokes = [],
  disabled = false,
  onSubmit = vi.fn(),
}: {
  initialStrokes?: InputStroke[];
  disabled?: boolean;
  onSubmit?: (strokes: InputStroke[]) => void;
}) {
  const [strokes, setStrokes] = useState<InputStroke[]>(initialStrokes);

  return (
    <WritingBoard
      strokes={strokes}
      disabled={disabled}
      onChange={setStrokes}
      onSubmit={onSubmit}
    />
  );
}

it("captures a continuous stroke and preserves it after a size change", async () => {
  const rect = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);
  const board = screen.getByTestId("writing-board");

  fireEvent.pointerDown(board, { pointerId: 7, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(board, { pointerId: 7, clientX: 200, clientY: 150 });
  fireEvent.pointerUp(board, { pointerId: 7, clientX: 250, clientY: 175 });

  await waitFor(() => {
    expect(board.querySelector("path")).toHaveAttribute(
      "d",
      "M 256 256 L 512 384 L 640 448",
    );
  });
  expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(7);
  expect(Element.prototype.releasePointerCapture).toHaveBeenCalledWith(7);
  expect(screen.getByRole("button", { name: "清空重写" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "提交" })).toBeEnabled();

  rect.mockReturnValue(boardRect(800, 400));
  window.dispatchEvent(new Event("resize"));

  await waitFor(() => {
    expect(board.querySelector("path")).toHaveAttribute(
      "d",
      "M 256 256 L 512 384 L 640 448",
    );
  });
  await userEvent.click(screen.getByRole("button", { name: "提交" }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0]?.[0]).toEqual([
    {
      id: expect.any(String),
      points: [
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.375 },
        { x: 0.625, y: 0.4375 },
      ],
    },
  ]);
});

it("clears strokes without submitting and disables both actions when empty", async () => {
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);
  const board = screen.getByTestId("writing-board");
  const submit = screen.getByRole("button", { name: "提交" });
  const clear = screen.getByRole("button", { name: "清空重写" });

  expect(submit).toBeDisabled();
  expect(clear).toBeDisabled();
  fireEvent.pointerDown(board, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(board, { pointerId: 1, clientX: 100, clientY: 100 });
  expect(submit).toBeEnabled();

  await userEvent.click(clear);

  expect(submit).toBeDisabled();
  expect(clear).toBeDisabled();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("ignores additional pointers until the active stroke ends", async () => {
  render(<Harness />);
  const board = screen.getByTestId("writing-board");

  fireEvent.pointerDown(board, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerDown(board, { pointerId: 2, clientX: 300, clientY: 300 });
  fireEvent.pointerMove(board, { pointerId: 2, clientX: 350, clientY: 350 });
  fireEvent.pointerMove(board, { pointerId: 1, clientX: 200, clientY: 200 });

  await waitFor(() => {
    expect(board.querySelector("path")).toHaveAttribute(
      "d",
      "M 256 256 L 512 512",
    );
  });
  expect(board.querySelectorAll("path")).toHaveLength(1);

  fireEvent.pointerUp(board, { pointerId: 1, clientX: 200, clientY: 200 });
  expect(Element.prototype.setPointerCapture).toHaveBeenCalledTimes(1);
});

it("appends every coalesced pointer sample without deduplicating", async () => {
  render(<Harness />);
  const board = screen.getByTestId("writing-board");

  fireEvent.pointerDown(board, { pointerId: 4, clientX: 100, clientY: 100 });

  const move = new MouseEvent("pointermove", { bubbles: true });
  Object.defineProperties(move, {
    pointerId: { value: 4 },
    getCoalescedEvents: {
      value: () => [
        new MouseEvent("pointermove", { clientX: 200, clientY: 100 }),
        new MouseEvent("pointermove", { clientX: 200, clientY: 100 }),
        new MouseEvent("pointermove", { clientX: 300, clientY: 200 }),
      ],
    },
  });
  fireEvent(board, move);

  await waitFor(() => {
    expect(board.querySelector("path")).toHaveAttribute(
      "d",
      "M 256 256 L 512 256 L 512 256 L 768 512",
    );
  });
});

it("removes an unfinished stroke when the pointer is cancelled", async () => {
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);
  const board = screen.getByTestId("writing-board");

  fireEvent.pointerDown(board, { pointerId: 8, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(board, { pointerId: 8, clientX: 200, clientY: 200 });
  fireEvent.pointerCancel(board, { pointerId: 8, clientX: 200, clientY: 200 });

  await waitFor(() => {
    expect(board.querySelector("path")).not.toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: "提交" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "清空重写" })).toBeDisabled();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("discards the active stroke and releases capture when disabled mid-stroke", async () => {
  const onSubmit = vi.fn();
  const { rerender } = render(<Harness onSubmit={onSubmit} />);
  const board = screen.getByTestId("writing-board");

  fireEvent.pointerDown(board, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(board, { pointerId: 1, clientX: 200, clientY: 200 });
  await waitFor(() => {
    expect(board.querySelectorAll("path")).toHaveLength(1);
  });

  fireEvent.pointerDown(board, { pointerId: 2, clientX: 300, clientY: 300 });
  fireEvent.pointerMove(board, { pointerId: 2, clientX: 350, clientY: 350 });
  expect(board.querySelectorAll("path")).toHaveLength(2);

  rerender(<Harness disabled onSubmit={onSubmit} />);

  await waitFor(() => {
    expect(board.querySelectorAll("path")).toHaveLength(1);
  });
  expect(board.querySelector("path")).toHaveAttribute("d", "M 256 256 L 512 512");
  expect(Element.prototype.releasePointerCapture).toHaveBeenCalledWith(2);

  fireEvent.pointerCancel(board, { pointerId: 2, clientX: 350, clientY: 350 });
  fireEvent.pointerUp(board, { pointerId: 2, clientX: 350, clientY: 350 });
  expect(board.querySelectorAll("path")).toHaveLength(1);

  rerender(<Harness onSubmit={onSubmit} />);
  fireEvent.pointerDown(board, { pointerId: 3, clientX: 400, clientY: 400 });
  fireEvent.pointerUp(board, { pointerId: 3, clientX: 450, clientY: 450 });

  await waitFor(() => {
    expect(board.querySelectorAll("path")).toHaveLength(2);
  });
  expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(3);
  expect(onSubmit).not.toHaveBeenCalled();
});

it("keeps existing strokes visible while disabled and ignores input and actions", async () => {
  const strokes = [
    {
      id: "existing",
      points: [
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.5 },
      ],
    },
  ];
  const onSubmit = vi.fn();
  render(<Harness initialStrokes={strokes} disabled onSubmit={onSubmit} />);
  const board = screen.getByTestId("writing-board");

  expect(board.querySelector("path")).toHaveAttribute("d", "M 256 256 L 512 512");
  expect(screen.getByRole("button", { name: "清空重写" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "提交" })).toBeDisabled();

  fireEvent.pointerDown(board, { pointerId: 9, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(board, { pointerId: 9, clientX: 200, clientY: 200 });
  fireEvent.pointerUp(board, { pointerId: 9, clientX: 200, clientY: 200 });

  expect(board.querySelectorAll("path")).toHaveLength(1);
  expect(board.querySelector("path")).toHaveAttribute("d", "M 256 256 L 512 512");
  expect(onSubmit).not.toHaveBeenCalled();
});

it("exposes the writing instructions and touch-safe visual contract", () => {
  render(<Harness />);
  const board = screen.getByTestId("writing-board");

  expect(screen.getByText("请按笔顺在田字格中书写")).toBeVisible();
  expect(board).toHaveAttribute("role", "group");
  expect(board).toHaveAttribute("aria-label", "手写田字格，可手指或触控笔书写");
  expect(board.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1024 1024");
  expect(board.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(css).toMatch(/\.writing-board\s*\{[^}]*touch-action:\s*none/s);
  expect(css).toMatch(/\.writing-board\s*\{[^}]*aspect-ratio:\s*1/s);
  expect(css).toMatch(/\.writing-board__svg\s*\{[^}]*pointer-events:\s*none/s);
  expect(css).toMatch(/\.writing-board-actions\s+\.button\s*\{[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/s);
});
