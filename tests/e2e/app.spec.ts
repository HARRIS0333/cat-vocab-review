import { expect, test, type Page } from "@playwright/test";
import {
  chooseSimpleTarget,
  drawMedians,
  drawOneWrongStroke,
  expectCachedAsset,
  expectNoHorizontalOverflow,
  openSingleItemPractice,
  waitForOfflineReady,
} from "./helpers";

async function practiceHeaderMetrics(page: Page) {
  return page.locator(".practice-page").evaluate((practice) => {
    const back = practice.querySelector(":scope > .text-link");
    const eyebrow = practice.querySelector(":scope > .eyebrow");
    const title = practice.querySelector(":scope > #practice-heading");
    const mode = practice.querySelector(":scope > .mode-switch");
    if (!back || !eyebrow || !title || !mode) {
      throw new Error("Practice header is incomplete");
    }

    const rect = (element: Element) =>
      element.getBoundingClientRect();
    const backRect = rect(back);
    const eyebrowRect = rect(eyebrow);
    const titleRect = rect(title);
    const modeRect = rect(mode);

    return {
      backTop: Math.round(backRect.top),
      backWidth: Math.round(backRect.width),
      eyebrowTop: Math.round(eyebrowRect.top),
      titleTop: Math.round(titleRect.top),
      titleLineHeight: Math.round(
        Number.parseFloat(getComputedStyle(title).lineHeight),
      ),
      modeTop: Math.round(modeRect.top),
      modeLeft: Math.round(modeRect.left),
      modeWidth: Math.round(modeRect.width),
      modeLinkWidths: Array.from(
        practice.querySelectorAll(":scope > .mode-switch .mode-switch-link"),
      ).map((link) => Math.round(link.getBoundingClientRect().width)),
    };
  });
}

test("loads under the GitHub Pages subpath and becomes offline-ready", async ({
  page,
}) => {
  await page.goto("./");

  await expect(
    page.getByRole("heading", { name: "小咪学生字" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("heading", { name: "选择课目" }),
  ).toBeVisible();
  await waitForOfflineReady(page);

  expect(new URL(page.url()).pathname).toBe("/cat-vocab/");
  await expectNoHorizontalOverflow(page);
});

test("keeps practice header geometry and footer navigation consistent", async ({
  page,
}) => {
  await page.goto("./#/lesson/lesson-1/read");
  await expect(
    page.getByRole("heading", { name: "1 观潮" }),
  ).toBeVisible();
  const recognitionMetrics = await practiceHeaderMetrics(page);

  await page.goto("./#/lesson/lesson-1/write");
  await expect(
    page.getByRole("heading", { name: "1 观潮" }),
  ).toBeVisible();
  const writingMetrics = await practiceHeaderMetrics(page);

  expect(writingMetrics).toEqual(recognitionMetrics);
  const headerRows = await page.evaluate(() => {
    const brand = document.querySelector(".app-header .brand");
    const actions = document.querySelector(".app-header__actions");
    if (!brand || !actions) throw new Error("Header layout is incomplete");
    const brandRect = brand.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    return {
      brandTop: Math.round(brandRect.top),
      brandBottom: Math.round(brandRect.bottom),
      actionsTop: Math.round(actionsRect.top),
      actionsBottom: Math.round(actionsRect.bottom),
    };
  });
  expect(headerRows.actionsTop).toBeGreaterThanOrEqual(
    headerRows.brandTop - 1,
  );
  expect(headerRows.actionsBottom).toBeLessThanOrEqual(
    headerRows.brandBottom + 1,
  );

  const lessonToggle = page.locator("#lesson-drawer-trigger");
  if ((await lessonToggle.count()) > 0) {
    await expect(lessonToggle).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) <= 560) {
      await expect
        .poll(() => lessonToggle.evaluate((element) => element.innerText.trim()))
        .toBe("课目");
    }
  } else {
    await expect(
      page.getByRole("complementary", { name: "课目列表" }),
    ).toBeVisible();
  }
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("link", { name: "关于与许可" }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("link", { name: "关于与许可" }),
  ).toHaveCount(0);
});

test("draws real pointer strokes, shows correct feedback, summarizes, and persists progress", async ({
  page,
}) => {
  await page.goto("./");
  const target = await chooseSimpleTarget(page);
  const data = await openSingleItemPractice(page, target);
  await expectNoHorizontalOverflow(page);

  await drawMedians(page, data);
  await page.getByRole("button", { name: "提交" }).click();

  await expect(
    page.getByRole("dialog", { name: "写对了！" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole("heading", { name: "本次练习结果" }),
  ).toBeVisible();
  await expect(page.getByLabel("本次正确")).toContainText("1");
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "本次练习结果" }),
  ).toBeVisible();
  await page.goto("./");
  await expect(page.getByText("已掌握 1")).toBeVisible();
});

test("shows stroke-count feedback, autoplay guidance, and skip review summary", async ({
  page,
}) => {
  await page.goto("./");
  const target = await chooseSimpleTarget(page);
  await openSingleItemPractice(page, target);
  await expectNoHorizontalOverflow(page);

  await drawOneWrongStroke(page);
  await page.getByRole("button", { name: "提交" }).click();

  const errorDialog = page.getByRole("dialog", { name: "这次还差一点" });
  await expect(errorDialog).toBeVisible();
  await expect(page.getByText("笔画数量不对")).toBeVisible();
  const strokePlayer = page.getByRole("region", { name: /标准笔顺动画/ });
  await expect(strokePlayer).toBeVisible();
  await expect(strokePlayer.locator("svg")).toBeVisible();
  const strokePath = strokePlayer.locator("svg path").first();
  await expect(strokePath).toBeAttached({ timeout: 30_000 });
  await expect(strokePath).toHaveAttribute("d", /.+/);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole("button", { name: "重播笔顺" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2200);
  await expect(errorDialog).toBeVisible();
  await page.getByRole("button", { name: "先跳过" }).click();

  await expect(
    page.getByRole("heading", { name: "本次练习结果" }),
  ).toBeVisible();
  await expect(page.getByLabel("本次待复习")).toContainText("1");
  await expectNoHorizontalOverflow(page);
});

test("reloads offline after the first online visit, completes real writing, and opens a cached license", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await waitForOfflineReady(page);
  const target = await chooseSimpleTarget(page);
  await expectCachedAsset(page, "content.json");
  await expectCachedAsset(
    page,
    `characters/${encodeURIComponent(target.item.char)}.json`,
  );

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "小咪学生字" }),
  ).toBeVisible();

  const data = await openSingleItemPractice(page, target);
  await expectNoHorizontalOverflow(page);
  await drawMedians(page, data);
  await page.getByRole("button", { name: "提交" }).click();
  await expect(
    page.getByRole("dialog", { name: "写对了！" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "本次练习结果" }),
  ).toBeVisible();
  await expect(page.getByLabel("本次正确")).toContainText("1");
  await expectNoHorizontalOverflow(page);

  await page.goto("/cat-vocab/#/about");
  await expect(
    page.getByRole("heading", { name: /关于与许可/ }),
  ).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Hanzi Writer MIT 许可" }).click();
  const licensePage = await popupPromise;
  await expect(licensePage.locator("body")).toContainText("MIT License");

  await context.setOffline(false);
});
