import { describe, expect, it } from "vitest";
import type { ContentGroup } from "./types";
import {
  getWritingItems,
  getWritingSourceOptions,
  resolveWritingSource,
} from "./sources";

const group: ContentGroup = {
  id: "lesson-1",
  kind: "lesson",
  unit: "第一单元",
  title: "1 观潮",
  lessonNo: 1,
  sourcePage: 7,
  reading: [
    { id: "lesson-1:浩:hào", char: "浩", pinyin: "hào", polyphone: false },
    { id: "lesson-1:崩:bēng", char: "崩", pinyin: "bēng", polyphone: false },
    { id: "lesson-1:霎:shà", char: "霎", pinyin: "shà", polyphone: false },
  ],
  writing: [
    { id: "lesson-1:据:jù", char: "据", pinyin: "jù", polyphone: false },
    { id: "lesson-1:浩:hào", char: "浩", pinyin: "hào", polyphone: false },
    { id: "lesson-1:墙:qiáng", char: "墙", pinyin: "qiáng", polyphone: false },
  ],
};

describe("writing source selection", () => {
  it("keeps writing table order for writing source", () => {
    expect(getWritingItems(group, "writing").map((item) => item.char)).toEqual([
      "据",
      "浩",
      "墙",
    ]);
  });

  it("keeps reading table order for reading source", () => {
    expect(getWritingItems(group, "reading").map((item) => item.char)).toEqual([
      "浩",
      "崩",
      "霎",
    ]);
  });

  it("puts reading first and deduplicates both by first char occurrence", () => {
    expect(getWritingItems(group, "both").map((item) => item.char)).toEqual([
      "浩",
      "崩",
      "霎",
      "据",
      "墙",
    ]);
  });

  it("shows counts and disables empty options", () => {
    const emptyWriting = { ...group, writing: [] };
    expect(getWritingSourceOptions(emptyWriting)).toEqual([
      { source: "writing", label: "仅写字表", count: 0, disabled: true },
      { source: "reading", label: "仅识字表", count: 3, disabled: false },
      { source: "both", label: "写字表和识字表都有", count: 3, disabled: false },
    ]);
  });

  it("visibly falls back from an empty writing table to reading", () => {
    const result = resolveWritingSource({ ...group, writing: [] }, "writing");
    expect(result.source).toBe("reading");
    expect(result.switched).toBe(true);
    expect(result.notice).toBe("本课没有写字表内容，已切换到仅识字表");
    expect(result.items.map((item) => item.char)).toEqual(["浩", "崩", "霎"]);
  });
});
