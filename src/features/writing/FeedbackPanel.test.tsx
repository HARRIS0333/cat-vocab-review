import { render, screen } from "@testing-library/react";
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
      onNext={vi.fn()}
    />,
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
      onNext={vi.fn()}
    />,
  );
  expect(screen.getByText("小桃猫没看清，请再写清楚一点")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "再写一次" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "先跳过" })).not.toBeInTheDocument();
});
