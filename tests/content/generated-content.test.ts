import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import type { ContentFile } from "../../src/content/types";

const root = process.cwd();
const content = JSON.parse(
  fs.readFileSync(path.join(root, "public/content.json"), "utf8"),
) as ContentFile;
const index = JSON.parse(
  fs.readFileSync(path.join(root, "public/characters/index.json"), "utf8"),
) as { schemaVersion: number; chars: string[] };

describe("generated textbook content", () => {
  it("meets all fixed textbook counts", () => {
    expect(content.counts).toEqual({
      lessons: 27,
      gardens: 4,
      groups: 31,
      readingItems: 265,
      readingCounted: 250,
      polyphoneEntries: 15,
      writingItems: 250,
      uniqueTargets: 413,
    });
    expect(content.groups).toHaveLength(31);
  });

  it("uses stable unique group and item ids", () => {
    expect(content.groups.map((group) => group.id)).toEqual([
      "lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5", "lesson-6",
      "lesson-7", "garden-2", "lesson-8", "lesson-9", "lesson-10", "lesson-11",
      "lesson-12", "lesson-13", "lesson-14", "garden-4", "lesson-15",
      "lesson-16", "lesson-17", "lesson-18", "lesson-19", "garden-6",
      "lesson-20", "lesson-21", "lesson-22", "lesson-23", "garden-7",
      "lesson-24", "lesson-25", "lesson-26", "lesson-27",
    ]);
    const itemIds = content.groups.flatMap((group) => [
      ...group.reading.map((item) => item.id),
      ...group.writing.map((item) => item.id),
    ]);
    expect(new Set(itemIds).size).toBeGreaterThan(400);
    expect(itemIds.every((id) => /^[a-z]+-\d+:[^:]+:[^:]+$/.test(id))).toBe(true);
    expect(
      content.groups.every(
        (group) => Number.isInteger(group.sourcePage) && group.sourcePage > 0,
      ),
    ).toBe(true);
  });

  it("derives ids and every declared count from the actual groups", () => {
    const idsByTable = new Map<string, { reading: number; writing: number }>();
    const targetChars = new Set<string>();

    for (const group of content.groups) {
      const readingIds = new Set<string>();
      const writingIds = new Set<string>();
      for (const [table, items, seen] of [
        ["reading", group.reading, readingIds],
        ["writing", group.writing, writingIds],
      ] as const) {
        for (const item of items) {
          expect(item.id).toBe(`${group.id}:${item.char}:${item.pinyin}`);
          expect(seen.has(item.id), `${table} has duplicate id ${item.id}`).toBe(false);
          seen.add(item.id);
          targetChars.add(item.char);

          const occurrences = idsByTable.get(item.id) ?? { reading: 0, writing: 0 };
          occurrences[table] += 1;
          idsByTable.set(item.id, occurrences);
        }
      }
    }

    for (const [id, occurrences] of idsByTable) {
      expect(occurrences.reading, `${id} repeated in reading`).toBeLessThanOrEqual(1);
      expect(occurrences.writing, `${id} repeated in writing`).toBeLessThanOrEqual(1);
      expect(
        occurrences.reading + occurrences.writing,
        `${id} may only be shared across reading and writing`,
      ).toBeLessThanOrEqual(2);
    }

    const reading = content.groups.flatMap((group) => group.reading);
    const writing = content.groups.flatMap((group) => group.writing);
    expect({
      lessons: content.groups.filter((group) => group.kind === "lesson").length,
      gardens: content.groups.filter((group) => group.kind === "garden").length,
      groups: content.groups.length,
      readingItems: reading.length,
      readingCounted: reading.filter((item) => !item.polyphone).length,
      polyphoneEntries: reading.filter((item) => item.polyphone).length,
      writingItems: writing.length,
      uniqueTargets: targetChars.size,
    }).toEqual(content.counts);

    const sortedTargets = [...targetChars].sort();
    expect(sortedTargets).toHaveLength(index.chars.length);
    expect(sortedTargets).toEqual([...index.chars].sort());
  });

  it("does not replace existing character output when a source file is invalid", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task3-content-generator-"));
    try {
      const tempScript = path.join(tempRoot, "scripts/generate-content.mjs");
      const tempSourceDir = path.join(tempRoot, "data/source");
      const tempCharsDir = path.join(tempRoot, "node_modules/hanzi-writer-data");
      const tempOutputDir = path.join(tempRoot, "public/characters");
      fs.mkdirSync(path.dirname(tempScript), { recursive: true });
      fs.mkdirSync(tempSourceDir, { recursive: true });
      fs.mkdirSync(tempCharsDir, { recursive: true });
      fs.mkdirSync(tempOutputDir, { recursive: true });

      fs.copyFileSync(
        path.join(root, "scripts/generate-content.mjs"),
        tempScript,
      );
      fs.copyFileSync(
        path.join(root, "data/source/textbook.json"),
        path.join(tempSourceDir, "textbook.json"),
      );
      fs.copyFileSync(
        path.join(root, "data/source/polyphone-speech.json"),
        path.join(tempSourceDir, "polyphone-speech.json"),
      );

      const sourceCharsDir = path.join(root, "node_modules/hanzi-writer-data");
      const sortedChars = [...index.chars].sort();
      const missingChar = sortedChars.at(-1);
      expect(missingChar).toBeDefined();
      for (const char of sortedChars.slice(0, -1)) {
        fs.symlinkSync(
          path.join(sourceCharsDir, `${char}.json`),
          path.join(tempCharsDir, `${char}.json`),
        );
      }

      const previousOutput = path.join(tempOutputDir, "previous-output.json");
      fs.writeFileSync(previousOutput, '{"preserve":true}');
      const result = spawnSync(process.execPath, [tempScript], {
        cwd: tempRoot,
        encoding: "utf8",
      });

      expect(result.status, result.stderr).not.toBe(0);
      expect(result.stderr).toContain(`missing Hanzi Writer data for ${missingChar}`);
      expect(fs.existsSync(previousOutput), "old output was replaced before validation completed").toBe(true);
      expect(fs.readFileSync(previousOutput, "utf8")).toBe('{"preserve":true}');
      expect(fs.readdirSync(tempOutputDir)).toEqual(["previous-output.json"]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("provides speech text for every blue polyphone entry", () => {
    const polyphones = content.groups.flatMap((group) =>
      group.reading.filter((item) => item.polyphone),
    );
    expect(polyphones).toHaveLength(15);
    expect(polyphones.every((item) => Boolean(item.speechText))).toBe(true);
    expect(
      Object.fromEntries(
        polyphones.map((item) => [`${item.char}|${item.pinyin}`, item.speechText]),
      ),
    ).toEqual({
      "薄|bó": "单薄",
      "脏|zāng": "肮脏",
      "屏|píng": "屏幕",
      "溜|liù": "一溜烟",
      "将|jiàng": "将领",
      "划|huà": "计划",
      "降|xiáng": "投降",
      "曲|qū": "弯曲",
      "脏|zàng": "心脏",
      "佛|fó": "佛香阁",
      "着|zhuó": "着手",
      "露|lòu": "露脸",
      "啊|ā": "啊呀",
      "唉|āi": "唉声叹气",
      "钉|dīng": "钉子",
    });
  });

  it("contains one valid stroke file for every unique target character", () => {
    expect(index.schemaVersion).toBe(1);
    expect(index.chars).toHaveLength(413);
    expect(new Set(index.chars).size).toBe(413);
    for (const char of index.chars) {
      const file = path.join(root, "public/characters", `${char}.json`);
      expect(fs.existsSync(file), `${char} stroke data missing`).toBe(true);
      const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
        medians: unknown[][];
        strokes: string[];
      };
      expect(data.strokes.length).toBe(data.medians.length);
      expect(data.strokes.length).toBeGreaterThan(0);
    }

    const files = fs.readdirSync(path.join(root, "public/characters"));
    expect(files.filter((file) => file !== "index.json")).toHaveLength(413);
    expect(files.some((file) => file.includes("%"))).toBe(false);
  });

  it("serves an encoded character URL from the decoded disk filename", async () => {
    const character = index.chars[0];
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      server: { host: "127.0.0.1", port: 0 },
    });

    try {
      await server.listen();
      const address = server.resolvedUrls?.local[0];
      expect(address).toBeTruthy();
      const response = await fetch(
        new URL(`characters/${encodeURIComponent(character)}.json`, address),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      const data = (await response.json()) as { strokes: string[]; medians: unknown[][] };
      expect(data.strokes.length).toBeGreaterThan(0);
      expect(data.strokes.length).toBe(data.medians.length);
    } finally {
      await server.close();
    }
  });
});
