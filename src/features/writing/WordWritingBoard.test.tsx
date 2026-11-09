import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InputStroke } from "../../handwriting/types";
import { WordWritingBoard } from "./WordWritingBoard";

function boardRect(width = 300, height = 300): DOMRect {
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

const characters = [
  { char: "据", pinyin: "jù" },
  { char: "说", pinyin: "shuō" },
];

function Harness({ onSubmit }: { onSubmit: (strokes: InputStroke[][]) => void }) {
  const [strokes, setStrokes] = useState<InputStroke[][]>([[], []]);
  return (
    <WordWritingBoard
      characters={characters}
      strokes={strokes}
      onChange={setStrokes}
      onSubmit={onSubmit}
    />
  );
}

it("renders one pinyin-labelled grid per character and submits the complete word", async () => {
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);

  expect(screen.getByText("jù")).toBeVisible();
  expect(screen.getByText("shuō")).toBeVisible();
  expect(screen.getByTestId("writing-board-0")).toBeVisible();
  expect(screen.getByTestId("writing-board-1")).toBeVisible();
  expect(screen.queryByText("据")).not.toBeInTheDocument();
  expect(screen.queryByText("说")).not.toBeInTheDocument();

  const first = screen.getByTestId("writing-board-0");
  const second = screen.getByTestId("writing-board-1");
  fireEvent.pointerDown(first, { pointerId: 1, clientX: 30, clientY: 30 });
  fireEvent.pointerMove(first, { pointerId: 1, clientX: 120, clientY: 30 });
  fireEvent.pointerUp(first, { pointerId: 1, clientX: 240, clientY: 30 });

  const submit = screen.getByRole("button", { name: "提交" });
  expect(submit).toBeDisabled();

  fireEvent.pointerDown(second, { pointerId: 2, clientX: 30, clientY: 90 });
  fireEvent.pointerMove(second, { pointerId: 2, clientX: 120, clientY: 90 });
  fireEvent.pointerUp(second, { pointerId: 2, clientX: 240, clientY: 90 });

  await waitFor(() => expect(submit).toBeEnabled());
  await userEvent.click(submit);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0]?.[0]).toHaveLength(2);
  const submitted = onSubmit.mock.calls[0]?.[0] as InputStroke[][] | undefined;
  expect(submitted?.every((entry) => entry.length === 1)).toBe(true);
});

it("clears every grid and blocks the iOS context menu", async () => {
  render(<Harness onSubmit={vi.fn()} />);
  const first = screen.getByTestId("writing-board-0");
  const second = screen.getByTestId("writing-board-1");
  for (const [index, board] of [first, second].entries()) {
    fireEvent.pointerDown(board, { pointerId: index + 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(board, { pointerId: index + 1, clientX: 200, clientY: 200 });
  }

  await waitFor(() => {
    expect(first.querySelector("path")).toBeInTheDocument();
    expect(second.querySelector("path")).toBeInTheDocument();
  });
  expect(fireEvent.contextMenu(screen.getByRole("region", { name: "词语手写练习" }))).toBe(false);

  await userEvent.click(screen.getByRole("button", { name: "清空重写" }));
  expect(first.querySelector("path")).not.toBeInTheDocument();
  expect(second.querySelector("path")).not.toBeInTheDocument();
});
