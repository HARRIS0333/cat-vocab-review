import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { makeContentFixture } from "../../test/fixtures";
import { LessonList } from "./LessonList";

it("links every group to recognition mode, preserves order, and shows counts", () => {
  const content = makeContentFixture();
  render(<LessonList groups={content.groups} />);

  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAccessibleName(/1 观潮.*识字 3.*写字 3/);
  expect(links[0]).toHaveAttribute("href", "#/lesson/lesson-1/read");
  expect(links[1]).toHaveAccessibleName(/2 繁星.*识字 2.*写字 0/);
  expect(links[1]).toHaveAttribute("href", "#/lesson/lesson-2/read");
  expect(screen.getByRole("list")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "第一单元" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "第二单元" })).toBeInTheDocument();
});

it("uses readable fallbacks for blank group text", () => {
  const content = makeContentFixture();
  const group = content.groups[0]!;
  render(
    <LessonList
      groups={[
        {
          ...group,
          id: " blank-group ",
          unit: "   ",
          title: "   ",
        },
      ]}
    />,
  );

  expect(screen.getByRole("heading", { name: "未分单元" })).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /未命名课目.*识字 3.*写字 3/ }),
  ).toHaveAttribute("href", "#/lesson/%20blank-group%20/read");
});
