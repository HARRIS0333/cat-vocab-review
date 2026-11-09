import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ModeSwitch } from "./ModeSwitch";

it("links the current lesson to both modes and marks current mode", () => {
  render(<ModeSwitch groupId="lesson-3" mode="write" />);

  expect(screen.getByRole("link", { name: "认读" })).toHaveAttribute(
    "href",
    "#/lesson/lesson-3/read",
  );
  expect(screen.getByRole("link", { name: "书写" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

it("preserves retry mode when switching practice type", () => {
  render(<ModeSwitch groupId="课/一" mode="read" retry />);

  expect(screen.getByRole("link", { name: "书写" })).toHaveAttribute(
    "href",
    `#/lesson/${encodeURIComponent("课/一")}/write?retry=1`,
  );
  expect(screen.getByRole("link", { name: "认读" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
