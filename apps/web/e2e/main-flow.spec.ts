import { test, expect, type Page } from "@playwright/test";

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/recommendations/recompute");
  expect(res.ok()).toBeTruthy();
});

async function fillStable(page: Page, label: string, value: string) {
  const input = page.getByLabel(label);
  await expect(input).toBeVisible();
  await expect(async () => {
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }).toPass();
}

test.describe("SubBuddy 主要導線", () => {
  test("ダッシュボードに合計と件数が表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
    await expect(page.getByText("月額合計（継続中）")).toBeVisible();
    await expect(page.getByText(/¥[\d,]+/).first()).toBeVisible();
  });

  test("一覧から詳細へ遷移できる", async ({ page }) => {
    await page.goto("/subscriptions");
    await expect(page.getByRole("heading", { name: /サブスク一覧/ })).toBeVisible();
    await page.getByText("AIツールX").click();
    await expect(page.getByRole("heading", { name: "AIツールX" })).toBeVisible();
    await expect(page.getByText("契約情報")).toBeVisible();
  });

  test("レコメンドに判定別グループが出る", async ({ page }) => {
    await page.goto("/recommendations");
    await expect(page.getByText(/強い解約候補（/)).toBeVisible();
    await expect(page.getByRole("link", { name: /AIツールX/ })).toBeVisible();
    await expect(page.getByText(/解約検討（/)).toBeVisible();
  });

  test("再計算ボタンで recompute API が呼ばれる", async ({ page }) => {
    await page.goto("/recommendations");
    await page.waitForLoadState("networkidle");
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/recommendations/recompute") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "判定を再計算" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expect(page.getByText(/強い解約候補（/)).toBeVisible();
  });

  test("継続ラベルが表示される", async ({ page }) => {
    await page.goto("/subscriptions");
    const card = page.getByRole("link", { name: /学習サブスク/ });
    await expect(card).toContainText("継続");
  });

  test("passive のサブスクに「使っていない」判定が出ない", async ({ page }) => {
    // Dropbox（usage_type=passive）は最終利用が90日前でも P1 適用外 → 継続のまま
    await page.goto("/subscriptions");
    const card = page.getByRole("link", { name: /Dropbox/ });
    await expect(card).toContainText("継続");

    await card.click();
    await expect(page.getByRole("heading", { name: "Dropbox" })).toBeVisible();
    // 最終利用は把握しているのに、判定理由に「使っていない」系のパターンが出ない
    await expect(page.getByText("最終利用からの日数")).toBeVisible();
    await expect(
      page.getByText("見直し対象に該当する条件がありません。継続をおすすめします。"),
    ).toBeVisible();
    await expect(page.getByText(/最後に使ったのは/)).toHaveCount(0);
  });

  test("知識ベース連携でダウングレード提案が出る", async ({ page }) => {
    // Netflix（matchedServiceId 付き・プレミアム ¥2,290）に安いプラン（P3）の提案が出る
    await page.goto("/subscriptions");
    await page.getByRole("link", { name: /Netflix/ }).click();
    await expect(page.getByRole("heading", { name: "Netflix" })).toBeVisible();
    await expect(page.getByText(/広告つきスタンダード（¥790\/月）に変更できます/)).toBeVisible();
  });

  test("サブスクを登録して一覧に現れ、削除できる", async ({ page }) => {
    const name = "E2Eテスト動画（合成）";

    await page.goto("/subscriptions/new");
    await page.waitForLoadState("networkidle");
    await fillStable(page, "サービス名", name);
    await page.getByText(`「${name}」を新しいサービスとして登録する`).click();
    await fillStable(page, "カテゴリ", "video");
    await fillStable(page, "金額（円・整数）", "700");
    await fillStable(page, "重要度（1〜5）", "3");
    await page.getByRole("button", { name: "保存" }).click();

    const detailUrl = (u: URL) =>
      /\/subscriptions\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new");
    await page.waitForURL(detailUrl);
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.goto("/subscriptions");
    await expect(page.getByText(name)).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await page.getByText(name).click();
    await page.waitForURL(detailUrl);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "削除" }).click();

    await page.waitForURL(/\/subscriptions$/);
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
