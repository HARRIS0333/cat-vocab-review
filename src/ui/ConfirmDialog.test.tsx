import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

it("requires an explicit confirmation and supports Escape cancellation", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="清除全部学习进度？"
      description="清除后无法恢复。"
      confirmLabel="清除进度"
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );

  expect(
    screen.getByRole("dialog", { name: "清除全部学习进度？" }),
  ).toHaveAttribute("aria-modal", "true");
  expect(screen.getByText("清除后无法恢复。")).toHaveAttribute(
    "id",
    expect.any(String),
  );
  const cancel = screen.getByRole("button", { name: "取消" });
  await waitFor(() => expect(cancel).toHaveFocus());

  await userEvent.click(cancel);
  expect(onCancel).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalledTimes(2);
  expect(onConfirm).not.toHaveBeenCalled();
});

it("emphasizes a destructive confirmation without hiding its text", async () => {
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      title="清除全部学习进度？"
      description="清除后无法恢复。"
      confirmLabel="清除进度"
      destructive
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );

  const confirm = screen.getByRole("button", { name: "清除进度" });
  expect(confirm).toHaveClass("button-destructive");
  await userEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it("does not render when closed", () => {
  render(
    <ConfirmDialog
      open={false}
      title="清除全部学习进度？"
      description="清除后无法恢复。"
      confirmLabel="清除进度"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
