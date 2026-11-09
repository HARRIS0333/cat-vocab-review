import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Button } from "./Button";

it("renders a semantic button with variant and size classes", () => {
  render(
    <Button variant="secondary" size="small" type="button">
      再试一次
    </Button>,
  );

  const button = screen.getByRole("button", { name: "再试一次" });
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveClass("button", "button-secondary", "button-small");
});

it("defaults to a primary button and preserves native button props", () => {
  render(<Button disabled>继续</Button>);

  expect(screen.getByRole("button", { name: "继续" })).toHaveClass(
    "button",
    "button-primary",
  );
  expect(screen.getByRole("button", { name: "继续" })).toBeDisabled();
});
