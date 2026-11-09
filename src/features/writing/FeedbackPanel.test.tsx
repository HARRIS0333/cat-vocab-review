import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { FeedbackPanel } from "./FeedbackPanel";

const data = {
  strokes: ["M 100 500 L 900 500"],
  medians: [[{ x: 100, y: 500 }, { x: 900, y: 500 }]],
};

vi.mock("../../ui/StrokePlayer", () => ({
  StrokePlayer: ({ autoPlay }: { autoPlay?: boolean }) => (
    <div data-testid="stroke-player">{String(autoPlay)}</div>
  ),
}));

it("shows a concrete reason, autoplays strokes, and offers retry or skip", async () => {
  const onRetry = vi.fn();
  const onSkip = vi.fn();
  render(
    <FeedbackPanel
      evaluation={{
        verdict: "incorrect",
        reasons: ["stroke_order"],
        confidence: 0.6,
        strokeMatches: [],
      }}
      char="据"
      characterData={data}
      attempt={1}
      onRetry={onRetry}
      onSkip={onSkip}
    />,
  );
  expect(screen.getByRole("dialog", { name: "这次还差一点" })).toHaveAttribute(
    "aria-modal",
    "true",
  );
  expect(screen.getByRole("heading", { name: "这次还差一点" })).toBeInTheDocument();
  expect(screen.getByText("笔画顺序不对")).toBeInTheDocument();
  expect(screen.getByTestId("stroke-player")).toHaveTextContent("true");
  await userEvent.click(screen.getByRole("button", { name: "再写一次" }));
  await userEvent.click(screen.getByRole("button", { name: "先跳过" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onSkip).toHaveBeenCalledTimes(1);
});

it("asks for clearer writing without counting it as an error", () => {
  render(
    <FeedbackPanel
      evaluation={{
        verdict: "unclear",
        reasons: ["ink_quality"],
        confidence: 0.2,
        strokeMatches: [],
      }}
      char="据"
      characterData={data}
      attempt={1}
      onRetry={vi.fn()}
      onSkip={vi.fn()}
    />,
  );
  expect(screen.getByText("小桃猫没看清，请再写清楚一点")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "再写一次" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "先跳过" })).not.toBeInTheDocument();
});

it("shows the success message as a modal without an action button", () => {
  render(
    <FeedbackPanel
      evaluation={{
        verdict: "correct",
        reasons: [],
        confidence: 1,
        strokeMatches: [],
      }}
      char="据"
      characterData={data}
      attempt={1}
      onRetry={vi.fn()}
      onSkip={vi.fn()}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "写对了！" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(dialog).toBeInTheDocument();
});
