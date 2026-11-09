import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenContent(): never {
  throw new Error("private handwriting and storage details");
}

it("shows a private, recoverable error page and invokes the injected reload", async () => {
  const reload = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <ErrorBoundary reload={reload}>
      <BrokenContent />
    </ErrorBoundary>,
  );

  expect(
    screen.getByRole("heading", { name: "页面遇到了一点问题" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("小桃猫暂时没能完成这一页");
  expect(screen.queryByText(/private handwriting/)).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: "重新加载应用" }),
  );
  expect(reload).toHaveBeenCalledTimes(1);
  consoleError.mockRestore();
});
