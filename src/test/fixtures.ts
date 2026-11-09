import type { ContentFile, ContentGroup } from "../content/types";

const firstGroup: ContentGroup = {
  id: "lesson-1",
  kind: "lesson",
  unit: "第一单元",
  title: "1 观潮",
  lessonNo: 1,
  sourcePage: 7,
  reading: [
    { id: "lesson-1:盐:yán", char: "盐", pinyin: "yán", polyphone: false },
    { id: "lesson-1:薄:bó", char: "薄", pinyin: "bó", polyphone: true },
    { id: "lesson-1:隆:lóng", char: "隆", pinyin: "lóng", polyphone: false },
  ],
  writing: [
    { id: "lesson-1:据:jù", char: "据", pinyin: "jù", polyphone: false },
    { id: "lesson-1:随:suí", char: "随", pinyin: "suí", polyphone: false },
    { id: "lesson-1:堤:dī", char: "堤", pinyin: "dī", polyphone: false },
  ],
};

const secondGroup: ContentGroup = {
  id: "lesson-2",
  kind: "lesson",
  unit: "第二单元",
  title: "2 繁星",
  lessonNo: 2,
  sourcePage: 10,
  reading: [
    { id: "lesson-2:昧:mèi", char: "昧", pinyin: "mèi", polyphone: false },
    { id: "lesson-2:坠:zhuì", char: "坠", pinyin: "zhuì", polyphone: false },
  ],
  writing: [],
};

export function makeContentFixture(): ContentFile {
  return {
    schemaVersion: 1,
    contentVersion: "fixture-1",
    edition: "统编版",
    publisher: "人民教育出版社",
    auditYear: 2024,
    source: {
      name: "国家中小学智慧教育平台",
      contentId: "fixture-content-id",
      ebookId: "fixture-ebook-id",
    },
    counts: {
      lessons: 27,
      gardens: 4,
      groups: 31,
      readingItems: 265,
      readingCounted: 250,
      polyphoneEntries: 15,
      writingItems: 250,
      uniqueTargets: 413,
    },
    groups: [firstGroup, secondGroup],
  };
}
