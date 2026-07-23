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
    await expect(page.getByText(/今月の支出は/)).toBeVisible();
    await expect(page.getByText("月額合計（継続中）")).toBeVisible();
    await expect(page.getByText(/¥[\d,]+/).first()).toBeVisible();
  });

  test("一覧から詳細へ遷移できる", async ({ page }) => {
    await page.goto("/subscriptions");
    await expect(page.getByText("契約", { exact: true }).first()).toBeVisible();
    await page.getByText("AIツールX").click();
    await expect(page.getByText("AIツールX", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("契約情報")).toBeVisible();
  });

  test("見直しに確認優先度別グループが出る", async ({ page }) => {
    await page.goto("/recommendations");
    await expect(page.getByText("見直し", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("今確認したい", { exact: true })).toBeVisible();
    await expect(page.getByText("情報が不足している", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /AIツールX/ })).toBeVisible();
    await expect(page.getByText(/強い解約候補|解約検討/)).toHaveCount(0);
  });

  test("使い方で4段階と任意の利用状況設定を確認できる", async ({ page }) => {
    await page.goto("/getting-started");
    await expect(page.getByText("使い方", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("契約を棚卸しする")).toBeVisible();
    await expect(page.getByText("支出と更新日を見る")).toBeVisible();
    await expect(page.getByText("見直す理由を見る")).toBeVisible();
    await expect(page.getByText("必要なら利用状況を加える")).toBeVisible();
    await expect(
      page.getByText("設定しなくても、料金、更新日、重複、プラン情報による見直しを利用できます。"),
    ).toBeVisible();
  });

  test("設定へ移動でき、local modeではログアウトを表示しない", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "設定", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("設定", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(
        "この環境はログインを使わず、この端末内だけで利用します。そのためログアウト操作はありません。",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "ログアウト" })).toHaveCount(0);
  });

  test("200%相当の表示幅でもキーボードで案内の操作へ到達できる", async ({ page }) => {
    // 1280px幅を200%拡大したときに相当するCSS表示幅で確認する。
    await page.setViewportSize({ width: 640, height: 720 });
    await page.goto("/getting-started");

    const guide = page.getByRole("region", { name: "はじめ方" });
    await expect(guide).toBeVisible();
    let reachedGuide = false;
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      reachedGuide = await guide.evaluate((element) => element.contains(document.activeElement));
      if (reachedGuide) break;
    }
    expect(reachedGuide).toBeTruthy();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test("再計算ボタンで recompute API が呼ばれる", async ({ page }) => {
    await page.goto("/recommendations");
    await page.waitForLoadState("networkidle");
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/recommendations/recompute") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "見直し材料を再計算" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expect(page.getByText("今確認したい", { exact: true })).toBeVisible();
  });

  test("低優先度を継続推奨として表示しない", async ({ page }) => {
    await page.goto("/subscriptions");
    const card = page.getByRole("link", { name: /学習サブスク/ });
    await expect(card).toContainText("現時点では急いで確認する材料が少ない");
    await expect(card).not.toContainText("継続");
  });

  test("passive のサブスクに「使っていない」判定が出ない", async ({ page }) => {
    // Dropbox（usage_type=passive）は最終利用が90日前でも「使っていない」判定の対象外。
    // 料金など別の条件による見直し判定はあり得る。
    await page.goto("/subscriptions");
    const card = page.getByRole("link", { name: /Dropbox/ });
    await expect(card).toBeVisible();

    await card.click();
    await expect(page.getByText("Dropbox", { exact: true }).first()).toBeVisible();
    // 最終利用は把握しているのに、判定理由に「使っていない」系のパターンが出ない
    await expect(page.getByText("最終利用からの日数")).toBeVisible();
    await expect(page.getByText(/最後に使ったのは/)).toHaveCount(0);
  });

  test("出典のない料金候補と節約額を表示しない", async ({ page }) => {
    // Netflixのカタログ料金には確認済みの公式出典を付けていないため比較へ使わない。
    await page.goto("/subscriptions");
    await page.getByRole("link", { name: /Netflix/ }).click();
    await expect(page.getByText("Netflix", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("料金情報を90日以内に再確認できていない候補は表示していません。"),
    ).toBeVisible();
    await expect(page.getByText(/広告つきスタンダード/)).toHaveCount(0);
  });

  test("サブスクを登録して一覧に現れ、削除できる", async ({ page }) => {
    const name = "E2Eテスト動画（合成）";

    await page.goto("/subscriptions/new");
    await page.waitForLoadState("networkidle");
    await fillStable(page, "サービス名", name);
    await page.getByText(`「${name}」を新しいサービスとして登録する`).click();
    await fillStable(page, "カテゴリ", "video");
    await fillStable(page, "金額（円・整数）", "700");
    await page.getByRole("group", { name: "重要度" }).getByRole("button", { name: "3" }).click();
    await page.getByRole("button", { name: "保存" }).click();

    const detailUrl = (u: URL) =>
      /\/subscriptions\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new");
    await page.waitForURL(detailUrl);
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

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
