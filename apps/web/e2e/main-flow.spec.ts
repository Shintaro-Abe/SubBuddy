import { test, expect, type Page } from "@playwright/test";

/**
 * 主要導線の E2E（合成データ前提）。
 * 縦串：ダッシュボード → 一覧/詳細 → 再計算 → レコメンド（判定/観測中）→ 登録/削除。
 *
 * 判定の前提は beforeAll で API 再計算して決定的にする（UI ボタンの所要時間に依存させない）。
 * dev サーバはハイドレーション完了前に入力すると値が失われるため、入力後に値が定着したか検証する。
 */

// 再計算でスナップショットを確定させる（globalSetup の seed 直後は未判定のため）。
test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/recommendations/recompute");
  expect(res.ok()).toBeTruthy();
});

/** ハイドレーション差異で値が消えるのを避けるため、定着するまで埋める。 */
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

  test("レコメンドに判定別グループと観測中が出る", async ({ page }) => {
    await page.goto("/recommendations");
    await expect(page.getByText(/強い解約候補（/)).toBeVisible();
    await expect(page.getByRole("link", { name: /AIツールX/ })).toBeVisible();
    await expect(page.getByText(/観測中（/)).toBeVisible();
    await expect(page.getByText(/様子見（/)).toBeVisible();
  });

  test("再計算ボタンで recompute API が呼ばれる", async ({ page }) => {
    await page.goto("/recommendations");
    await page.waitForLoadState("networkidle"); // ハイドレーション完了を待つ
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/recommendations/recompute") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "判定を再計算" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expect(page.getByText(/強い解約候補（/)).toBeVisible();
  });

  test("様子見ラベルが glossary 準拠で表示される", async ({ page }) => {
    await page.goto("/subscriptions");
    const card = page.getByRole("link", { name: /学習サブスク/ });
    await expect(card).toContainText("様子見");
  });

  test("サブスクを登録して一覧に現れ、削除できる", async ({ page }) => {
    const name = "E2Eテスト動画（合成）";

    // 登録（ハイドレーション完了を待ってから入力）
    await page.goto("/subscriptions/new");
    await page.waitForLoadState("networkidle");
    await fillStable(page, "サービス名", name);
    await fillStable(page, "カテゴリ", "video");
    await fillStable(page, "金額（円・整数）", "700");
    await fillStable(page, "重要度（1〜5）", "3");
    await page.getByRole("button", { name: "保存" }).click();

    // 詳細（/subscriptions/<id>。/new ではない）へ遷移して登録名が見える
    const detailUrl = (u: URL) =>
      /\/subscriptions\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new");
    await page.waitForURL(detailUrl);
    await expect(page.getByRole("heading", { name })).toBeVisible();

    // 一覧にも出る
    await page.goto("/subscriptions");
    await expect(page.getByText(name)).toBeVisible();

    // 詳細から削除（confirm を承認）
    page.on("dialog", (d) => d.accept());
    await page.getByText(name).click();
    await page.waitForURL(detailUrl);
    await page.waitForLoadState("networkidle"); // 削除ボタンのハイドレーション待ち
    await page.getByRole("button", { name: "削除" }).click();

    // 一覧から消える
    await page.waitForURL(/\/subscriptions$/);
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
