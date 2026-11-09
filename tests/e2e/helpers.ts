import { expect, type Page } from "@playwright/test";

type PracticeItem = {
  id: string;
  char: string;
  pinyin: string;
  word: {
    chars: Array<{ char: string; pinyin: string }>;
  };
};

type ContentGroup = {
  id: string;
  writing: PracticeItem[];
  reading: PracticeItem[];
};

type CharacterData = {
  medians: Array<Array<[number, number]>>;
};

type SimpleTarget = {
  groupId: string;
  item: PracticeItem;
};

export async function waitForOfflineReady(page: Page): Promise<void> {
  await expect(
    page.getByRole("status", { name: "离线缓存状态" }),
  ).toContainText("已可离线使用", { timeout: 30_000 });
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

export async function expectCachedAsset(page: Page, asset: string): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(async (assetPath) => {
        const assetUrl = new URL(assetPath, document.baseURI).href;
        for (const cacheName of await caches.keys()) {
          const cache = await caches.open(cacheName);
          if (await cache.match(assetUrl, { ignoreSearch: true })) return true;
        }
        return false;
      }, asset),
    )
    .toBe(true);
}

export async function chooseSimpleTarget(page: Page): Promise<SimpleTarget> {
  const content = await page.evaluate(async () => {
    const response = await fetch("content.json");
    if (!response.ok) {
      throw new Error(`content.json returned ${response.status}`);
    }
    return (await response.json()) as { groups: ContentGroup[] };
  });

  for (const group of content.groups) {
    for (const item of group.writing) {
      const data = (await page.evaluate(async (char) => {
        const response = await fetch(`characters/${encodeURIComponent(char)}.json`);
        if (!response.ok) {
          throw new Error(`character data returned ${response.status}`);
        }
        return (await response.json()) as CharacterData;
      }, item.char)) as CharacterData;

      if (data.medians.length <= 3) {
        await page.evaluate(
          ({ groupId, itemId }) => {
            sessionStorage.setItem(
              "cat-vocab-retry-queue-v1",
              JSON.stringify({ [`${groupId}:write`]: [itemId] }),
            );
          },
          { groupId: group.id, itemId: item.id },
        );
        return { groupId: group.id, item };
      }
    }
  }

  throw new Error("No writing-table target with at most 3 strokes found");
}

export async function openSingleItemPractice(
  page: Page,
  target: SimpleTarget,
): Promise<CharacterData[]> {
  const characters = target.item.word.chars;
  const data = await page.evaluate(async (wordCharacters) => {
    return Promise.all(
      wordCharacters.map(async ({ char }) => {
        const response = await fetch(`characters/${encodeURIComponent(char)}.json`);
        if (!response.ok) {
          throw new Error(`character data returned ${response.status}`);
        }
        return (await response.json()) as CharacterData;
      }),
    );
  }, characters) as CharacterData[];

  await page.goto(
    `#/lesson/${encodeURIComponent(target.groupId)}/write?retry=1`,
  );
  const pinyin = page.locator(".writing-word-board__pinyin");
  await expect(pinyin).toHaveCount(characters.length);
  for (const [index, character] of characters.entries()) {
    await expect(pinyin.nth(index)).toHaveText(character.pinyin);
  }
  await expect(page.getByTestId("writing-board-0")).toBeVisible();
  return data;
}

export async function drawMedians(
  page: Page,
  allData: CharacterData[],
  startIndex = 0,
  skipIndex?: number,
): Promise<void> {
  for (const [offset, data] of allData.entries()) {
    const index = startIndex + offset;
    if (index === skipIndex) continue;
    const board = page.getByTestId(`writing-board-${index}`);
    await board.scrollIntoViewIfNeeded();
    const box = await board.boundingBox();
    if (!box) throw new Error(`writing board ${index} is not visible`);

    for (const median of data.medians) {
      const [first, ...rest] = median;
      if (!first) continue;

      await page.mouse.move(
        Math.round(box.x + (first[0] / 1024) * box.width),
        Math.round(box.y + ((900 - first[1]) / 1024) * box.height),
      );
      await page.mouse.down();
      for (const point of rest) {
        await page.mouse.move(
          Math.round(box.x + (point[0] / 1024) * box.width),
          Math.round(box.y + ((900 - point[1]) / 1024) * box.height),
          { steps: 2 },
        );
      }
      await page.mouse.up();
    }
  }
}

export async function drawOneWrongStroke(
  page: Page,
  allData: CharacterData[],
  wrongIndex = 0,
): Promise<void> {
  const board = page.getByTestId(`writing-board-${wrongIndex}`);
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error("writing board is not visible");

  await page.mouse.move(
    Math.round(box.x + box.width * 0.15),
    Math.round(box.y + box.height * 0.5),
  );
  await page.mouse.down();
  await page.mouse.move(
    Math.round(box.x + box.width * 0.85),
    Math.round(box.y + box.height * 0.5),
    { steps: 8 },
  );
  await page.mouse.up();

  await drawMedians(page, allData, 0, wrongIndex);
}
