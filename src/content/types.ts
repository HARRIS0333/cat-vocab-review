export type WritingSource = "writing" | "reading" | "both";

export type WordPracticeCharacter = {
  char: string;
  pinyin: string;
};

export type PracticeWord = {
  word: string;
  chars: WordPracticeCharacter[];
  source: "word-list" | "text";
};

export type PracticeItem = {
  id: string;
  char: string;
  pinyin: string;
  polyphone: boolean;
  speechText?: string;
  word?: PracticeWord;
};

export type ContentGroup = {
  id: string;
  kind: "lesson" | "garden";
  unit: string;
  title: string;
  lessonNo?: number;
  sourcePage: number;
  reading: PracticeItem[];
  writing: PracticeItem[];
};

export type ContentFile = {
  schemaVersion: 1;
  contentVersion: string;
  edition: string;
  publisher: string;
  auditYear: 2024;
  source: {
    name: "国家中小学智慧教育平台";
    contentId: string;
    ebookId: string;
  };
  counts: {
    lessons: 27;
    gardens: 4;
    groups: 31;
    readingItems: 265;
    readingCounted: 250;
    polyphoneEntries: 15;
    writingItems: 250;
    uniqueTargets: 413;
  };
  groups: ContentGroup[];
};

export type WritingSourceOption = {
  source: WritingSource;
  label: string;
  count: number;
  disabled: boolean;
};

export type ResolvedWritingSource = {
  source: WritingSource;
  items: PracticeItem[];
  switched: boolean;
  notice?: string;
};
