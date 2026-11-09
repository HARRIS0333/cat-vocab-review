import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ContentGroup } from "../../content/types";
import { SourceSelector } from "./SourceSelector";

const group: ContentGroup = {
  id: "lesson-3",
  kind: "lesson",
  unit: "第一单元",
  title: "3 现代诗二首",
  lessonNo: 3,
  sourcePage: 12,
  reading: [{ id: "lesson-3:巢:cháo", char: "巢", pinyin: "cháo", polyphone: false }],
  writing: [],
};

it("shows counts, disables an empty source, and exposes fallback notice", async () => {
  const onChange = vi.fn();
  render(
    <SourceSelector
      group={group}
      value="reading"
      notice="本课没有写字表内容，已切换到仅识字表"
      onChange={onChange}
    />,
  );
  expect(screen.getByRole("button", { name: "仅写字表 · 0 字" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "仅识字表 · 1 字" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("status")).toHaveTextContent("本课没有写字表内容");
  await userEvent.click(screen.getByRole("button", { name: "写字表和识字表都有 · 1 字" }));
  expect(onChange).toHaveBeenCalledWith("both");
});
