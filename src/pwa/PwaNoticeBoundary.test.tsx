import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PwaNoticeBoundary } from "./PwaNoticeBoundary";

function BrokenNotice(): never {
  throw new Error("private pwa internals");
}

it("keeps the practice UI mounted when optional PWA notices fail", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <>
      <PwaNoticeBoundary>
        <BrokenNotice />
      </PwaNoticeBoundary>
      <p>练习仍可继续</p>
    </>,
  );

  expect(screen.getByText("练习仍可继续")).toBeInTheDocument();
  expect(screen.queryByText(/private pwa internals/)).not.toBeInTheDocument();
  consoleError.mockRestore();
});
