import type {
  ContentGroup,
  PracticeItem,
  ResolvedWritingSource,
  WritingSource,
  WritingSourceOption,
} from "./types";

const labels: Record<WritingSource, string> = {
  writing: "仅写字表",
  reading: "仅识字表",
  both: "写字表和识字表都有",
};

export function getWritingItems(
  group: ContentGroup,
  source: WritingSource,
): PracticeItem[] {
  if (source === "writing") return [...group.writing];
  if (source === "reading") return [...group.reading];

  const seen = new Set<string>();
  return [...group.reading, ...group.writing].filter((item) => {
    if (seen.has(item.char)) return false;
    seen.add(item.char);
    return true;
  });
}

export function getWritingSourceOptions(
  group: ContentGroup,
): WritingSourceOption[] {
  return (Object.keys(labels) as WritingSource[]).map((source) => {
    const count = getWritingItems(group, source).length;
    return { source, label: labels[source], count, disabled: count === 0 };
  });
}

export function resolveWritingSource(
  group: ContentGroup,
  requested: WritingSource,
): ResolvedWritingSource {
  const requestedItems = getWritingItems(group, requested);
  if (requestedItems.length > 0) {
    return { source: requested, items: requestedItems, switched: false };
  }

  if (requested === "writing" && group.reading.length > 0) {
    return {
      source: "reading",
      items: getWritingItems(group, "reading"),
      switched: true,
      notice: "本课没有写字表内容，已切换到仅识字表",
    };
  }

  return { source: requested, items: [], switched: false };
}
