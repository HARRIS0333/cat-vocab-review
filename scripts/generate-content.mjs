import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "data/source/textbook.json");
const speechPath = path.join(root, "data/source/polyphone-speech.json");
const charsSourceDir = path.join(root, "node_modules/hanzi-writer-data");
const publicDir = path.join(root, "public");
const charsOutputDir = path.join(publicDir, "characters");
const sourceText = fs.readFileSync(sourcePath, "utf8");
const speechText = fs.readFileSync(speechPath, "utf8");
const source = JSON.parse(sourceText);
const speech = JSON.parse(speechText);
const gardenAfterLesson = new Map([
  [7, 2],
  [14, 4],
  [19, 6],
  [23, 7],
]);

function fail(message) {
  throw new Error(`Content validation failed: ${message}`);
}

function itemId(groupId, item) {
  return `${groupId}:${item.char}:${item.pinyin}`;
}

function parseGardenNo(title) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const match = title.trim().match(/^语文园地([一二三四五六七八九])$/);
  if (!match) fail(`invalid garden title: ${title}`);
  return map[match[1]];
}

function enrichItems(groupId, items) {
  if (!Array.isArray(items)) fail(`invalid item table in ${groupId}`);
  return items.map((item) => {
    if (
      typeof item.char !== "string" ||
      !item.char ||
      typeof item.pinyin !== "string" ||
      !item.pinyin.trim() ||
      typeof item.polyphone !== "boolean"
    ) {
      fail(`invalid item in ${groupId}`);
    }
    const speechTextValue = speech[`${item.char}|${item.pinyin}`];
    if (item.polyphone && !speechTextValue) {
      fail(`missing speech phrase for ${item.char} ${item.pinyin}`);
    }
    return {
      id: itemId(groupId, item),
      char: item.char,
      pinyin: item.pinyin,
      polyphone: item.polyphone,
      ...(speechTextValue ? { speechText: speechTextValue } : {}),
    };
  });
}

if (!Array.isArray(source.groups)) fail("source groups must be an array");

const groups = source.groups.map((group) => {
  const groupId =
    group.kind === "lesson"
      ? `lesson-${group.lessonNo}`
      : `garden-${parseGardenNo(group.title)}`;
  const sourcePage = group.sourcePage ?? group.page;
  if (!Number.isInteger(sourcePage) || sourcePage <= 0) {
    fail(`invalid source page for ${group.title}`);
  }
  return {
    id: groupId,
    kind: group.kind,
    unit: group.unit,
    title: group.title.trim(),
    ...(group.lessonNo ? { lessonNo: group.lessonNo } : {}),
    sourcePage,
    reading: enrichItems(groupId, group.reading),
    writing: enrichItems(groupId, group.writing),
  };
});

const expectedOrder = [];
for (let lessonNo = 1; lessonNo <= 27; lessonNo += 1) {
  expectedOrder.push(`lesson-${lessonNo}`);
  if (gardenAfterLesson.has(lessonNo)) {
    expectedOrder.push(`garden-${gardenAfterLesson.get(lessonNo)}`);
  }
}

const ids = groups.map((group) => group.id);
if (JSON.stringify(ids) !== JSON.stringify(expectedOrder)) fail("group order mismatch");
if (new Set(ids).size !== 31) fail("group ids are not unique");

const lessons = groups.filter((group) => group.kind === "lesson").length;
const gardens = groups.filter((group) => group.kind === "garden").length;
const reading = groups.flatMap((group) => group.reading);
const writing = groups.flatMap((group) => group.writing);
const readingCounted = reading.filter((item) => !item.polyphone).length;
const polyphoneEntries = reading.filter((item) => item.polyphone).length;
const targetChars = [...new Set([...reading, ...writing].map((item) => item.char))].sort();

if (lessons !== 27) fail(`expected 27 lessons, got ${lessons}`);
if (gardens !== 4) fail(`expected 4 gardens, got ${gardens}`);
if (groups.length !== 31) fail(`expected 31 groups, got ${groups.length}`);
if (reading.length !== 265) fail(`expected 265 reading items, got ${reading.length}`);
if (readingCounted !== 250) fail(`expected 250 counted reading chars, got ${readingCounted}`);
if (polyphoneEntries !== 15) fail(`expected 15 polyphone entries, got ${polyphoneEntries}`);
if (writing.length !== 250) fail(`expected 250 writing items, got ${writing.length}`);
if (targetChars.length !== 413) fail(`expected 413 target chars, got ${targetChars.length}`);
if ([...reading, ...writing].some((item) => !item.char || !item.pinyin.trim())) {
  fail("empty character or pinyin");
}
if (groups.some((group) => !Number.isInteger(group.sourcePage) || group.sourcePage <= 0)) {
  fail("group source page must be a positive integer");
}

const characterFiles = new Map();
for (const char of targetChars) {
  const sourceFile = path.join(charsSourceDir, `${char}.json`);
  if (!fs.existsSync(sourceFile)) fail(`missing Hanzi Writer data for ${char}`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  } catch (error) {
    fail(`invalid Hanzi Writer JSON for ${char}: ${error.message}`);
  }
  if (!Array.isArray(data.strokes) || !Array.isArray(data.medians)) {
    fail(`invalid Hanzi Writer data for ${char}`);
  }
  if (data.strokes.length === 0 || data.strokes.length !== data.medians.length) {
    fail(`stroke count mismatch for ${char}`);
  }
  characterFiles.set(char, { strokes: data.strokes, medians: data.medians });
}

fs.rmSync(charsOutputDir, { recursive: true, force: true });
fs.mkdirSync(charsOutputDir, { recursive: true });
for (const char of targetChars) {
  fs.writeFileSync(
    path.join(charsOutputDir, `${char}.json`),
    JSON.stringify(characterFiles.get(char)),
  );
}

const contentVersion = `2024-reader-${createHash("sha256")
  .update(sourceText)
  .update(speechText)
  .digest("hex")
  .slice(0, 12)}`;

const output = {
  schemaVersion: 1,
  contentVersion,
  edition: source.edition,
  publisher: source.publisher,
  auditYear: 2024,
  source: {
    name: "国家中小学智慧教育平台",
    contentId: "5cd7e623-5c38-4602-871a-3fba8a551db2",
    ebookId: "1cea417b-ba9c-44b7-b7c1-db53a962f2d4",
  },
  counts: {
    lessons,
    gardens,
    groups: groups.length,
    readingItems: reading.length,
    readingCounted,
    polyphoneEntries,
    writingItems: writing.length,
    uniqueTargets: targetChars.length,
  },
  groups,
};

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "content.json"), JSON.stringify(output));
fs.writeFileSync(
  path.join(charsOutputDir, "index.json"),
  JSON.stringify({ schemaVersion: 1, chars: targetChars }),
);
console.log(`Generated ${groups.length} groups and ${targetChars.length} characters`);
