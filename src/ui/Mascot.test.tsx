import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Mascot } from "./Mascot";

it("gives informative and decorative mascots the correct accessibility", () => {
  const { rerender } = render(<Mascot mood="wave" />);
  expect(screen.getByRole("img", { name: "小桃猫在招手" })).toBeInTheDocument();

  rerender(<Mascot mood="happy" label={null} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("uses a custom label and mood-specific artwork", () => {
  const { container } = render(<Mascot mood="hint" label="小桃猫来提示" />);

  expect(screen.getByRole("img", { name: "小桃猫来提示" })).toBeInTheDocument();
  expect(container.querySelector('[data-mood="hint"]')).toBeInTheDocument();
});

it("provides a descriptive default label for every supported mood", () => {
  const labels = {
    wave: "小桃猫在招手",
    read: "小桃猫在读书",
    write: "小桃猫在写字",
    happy: "小桃猫很开心",
    hint: "小桃猫来给提示",
    confused: "小桃猫有点困惑",
    celebrate: "小桃猫在庆祝",
  } as const;

  for (const mood of Object.keys(labels) as Array<keyof typeof labels>) {
    const label = labels[mood];
    const { unmount } = render(<Mascot mood={mood} />);
    expect(screen.getByRole("img", { name: label })).toHaveAttribute(
      "data-mood",
      mood,
    );
    unmount();
  }
});
