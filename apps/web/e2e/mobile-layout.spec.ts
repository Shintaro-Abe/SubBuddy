import { expect, test, type Page } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 430] as const;
const BROWSING_PAGES = [
  "/",
  "/subscriptions",
  "/spending",
  "/recommendations",
  "/renewals",
  "/getting-started",
  "/settings",
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
}

test.describe("iPhone向けWeb", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`${width}pxで全閲覧画面が横にはみ出さない`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      for (const path of BROWSING_PAGES) {
        await page.goto(path);
        await expect(page.locator(".mobile-topbar")).toBeVisible();
        await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
        await expect(page.locator(".side")).toBeHidden();
        await expectNoHorizontalOverflow(page);
      }
    });
  }

  test("横向きでも下部ナビと本文が重ならない", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/recommendations");
    await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const lastContent = page.locator("main").locator(":scope > *").last();
    await lastContent.scrollIntoViewIfNeeded();
    const [contentBox, navBox] = await Promise.all([
      lastContent.boundingBox(),
      page.locator(".mobile-bottom-nav").boundingBox(),
    ]);
    expect(contentBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(await page.locator("main").evaluate((element) => getComputedStyle(element).paddingBottom))
      .not.toBe("0px");
  });

  test("その他メニューから補助画面へ移動でき、閉じると起点へ戻る", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator('.mobile-bottom-link[aria-current="page"]')).toHaveText("ホーム");
    const trigger = page.getByRole("button", { name: "その他" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "その他" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /支出の内訳/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("link", { name: /設定/ }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('.mobile-bottom-link[aria-current="page"]')).toHaveCount(0);
  });

  test("契約追加フォームは1列で、入力画面では下部ナビを隠す", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/subscriptions/new");
    await expect(page.locator(".mobile-topbar")).toBeVisible();
    await expect(page.locator(".mobile-bottom-nav")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "前の画面へ戻る" })).toHaveAttribute(
      "href",
      "/subscriptions",
    );
    await expectNoHorizontalOverflow(page);

    const amount = page.getByLabel("金額（円・整数）");
    await expect(amount).toBeVisible();
    expect(await amount.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
    const save = page.getByRole("button", { name: "保存", exact: true });
    const saveBox = await save.boundingBox();
    expect(saveBox?.height).toBeGreaterThanOrEqual(44);
    expect(saveBox?.width).toBeGreaterThan(250);
  });

  test("支出はモバイル縦リスト、PCは棒グラフを表示する", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/spending");
    await expect(page.locator(".mobile-trend-list")).toBeVisible();
    await expect(page.locator(".bars")).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expect(page.locator(".bars")).toBeVisible();
    await expect(page.locator(".mobile-trend-list")).toBeHidden();
    await expect(page.locator(".side")).toBeVisible();
    await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
  });

  test("契約詳細を320pxで読め、削除は末尾の操作にある", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/subscriptions");
    const detailHref = await page
      .locator('a[href^="/subscriptions/"]:not([href$="/new"])')
      .first()
      .getAttribute("href");
    expect(detailHref).toBeTruthy();
    await page.goto(detailHref!);
    await expect(page.getByRole("heading", { name: "その他の操作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("契約編集とサインインも320pxで横にはみ出さない", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/subscriptions");
    const detailHref = await page
      .locator('a[href^="/subscriptions/"]:not([href$="/new"])')
      .first()
      .getAttribute("href");
    expect(detailHref).toBeTruthy();

    await page.goto(`${detailHref}/edit`);
    await expect(page.locator(".mobile-bottom-nav")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Appleでサインイン" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("画面説明は説明かボタンのどちらか一方だけを表示する", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/recommendations");
    const intro = page.getByRole("complementary", { name: "この画面について" });
    await expect(intro).toBeVisible();
    await expect(page.getByRole("button", { name: "この画面について" })).toHaveCount(0);

    await intro.getByRole("button", { name: "閉じる" }).click();
    await expect(intro).toHaveCount(0);
    await expect(page.getByRole("button", { name: "この画面について" })).toBeVisible();
  });

  test("合成200契約と長い名称・大きな金額でも一覧を利用できる", async ({ page, request }) => {
    const existing = await request.get("/api/subscriptions");
    expect(existing.ok()).toBeTruthy();
    const existingBody = (await existing.json()) as { items: unknown[] };
    const addCount = Math.max(0, 200 - existingBody.items.length);
    const createdIds: string[] = [];

    try {
      for (let offset = 0; offset < addCount; offset += 20) {
        const size = Math.min(20, addCount - offset);
        const responses = await Promise.all(
          Array.from({ length: size }, (_, index) => {
            const sequence = offset + index + 1;
            return request.post("/api/subscriptions", {
              data: {
                name: `Synthetic-Long-Subscription-${String(sequence).padStart(3, "0")}-${"X".repeat(80)}`,
                category: "synthetic",
                amount: 9_999_999,
                billingCycle: "monthly",
                importance: 3,
                status: "active",
                usageType: "active_foreground",
                notes: "合成データによる長文表示確認。".repeat(12),
              },
            });
          }),
        );
        for (const response of responses) {
          expect(response.ok()).toBeTruthy();
          const created = (await response.json()) as { id: string };
          createdIds.push(created.id);
        }
      }

      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto("/subscriptions");
      await expect(page.locator(".scard")).toHaveCount(200);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByText(/Synthetic-Long-Subscription/).first()).toBeVisible();
    } finally {
      for (let offset = 0; offset < createdIds.length; offset += 20) {
        await Promise.all(
          createdIds.slice(offset, offset + 20).map((id) => request.delete(`/api/subscriptions/${id}`)),
        );
      }
    }
  });

  test("200%相当でも主な操作領域が44px以上", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 720 });
    await page.goto("/");
    await expectNoHorizontalOverflow(page);
    const sizes = await page.locator(".mobile-bottom-link, .mobile-more-button").evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    expect(sizes.every((size) => size.width >= 44 && size.height >= 44)).toBeTruthy();
  });
});
