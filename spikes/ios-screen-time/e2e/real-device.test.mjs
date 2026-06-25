// 実機 E2E オーケストレータ。
//   ネイティブ操作 = Appium(XCUITest) / Web 確認 = Playwright。
//   成功なら exit 0、失敗なら artifacts にスクショ・Playwright trace を保存して exit 1。
//
// 注意: Screen Time 許可と対象アプリ選択は OS のプライバシーシートのため、既定では
//       自動操作しない（SKIP_SYSTEM_UI=true）。事前に手動で 1 回済ませておくこと（README）。

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { remote } from "webdriverio";
import { chromium } from "playwright";
import { config, appiumCapabilities } from "./config.mjs";

const log = (msg) => console.log(`[e2e] ${msg}`);

async function ensureArtifactsDir() {
  await mkdir(config.artifactsDir, { recursive: true });
}

// ── Appium: アクセシビリティ ID で要素を取得（待機つき。最上部の確実に見える要素用） ──
async function byId(driver, id) {
  const el = await driver.$(`~${id}`);
  await el.waitForExist({ timeout: config.appiumWaitMs });
  return el;
}

// SwiftUI の List は画面外の行を遅延描画するため、下方の要素はスクロールして探す。
async function findScrolling(driver, id, maxScrolls = 8) {
  for (let i = 0; i <= maxScrolls; i++) {
    const el = await driver.$(`~${id}`);
    if (await el.isExisting()) return el;
    await driver.execute("mobile: scroll", { direction: "down" }).catch(() => {});
    await driver.pause(300);
  }
  throw new Error(`要素 ~${id} が見つかりません（スクロール ${maxScrolls} 回後）`);
}

async function runNative(driver) {
  log("ネイティブ: アプリ起動を待機");
  // 最上部の認可セクションが見えればアプリ描画済み（スモーク）＋認可状態の確認
  const authStatus = await (await byId(driver, "auth-status")).getText();
  log(`ネイティブ: 認可状態 = ${authStatus}`);
  if (config.skipSystemUi && authStatus.includes("未認可")) {
    throw new Error(
      "未認可のまま実行されました。Screen Time 許可と対象アプリ選択を手動で 1 回済ませてください（README）。",
    );
  }

  // サブスク ID を入力
  if (config.subscriptionId) {
    log("ネイティブ: サブスク ID を入力");
    const field = await findScrolling(driver, "subscription-id-field");
    await field.click().catch(() => {});
    await field.clearValue().catch(() => {});
    await field.setValue(config.subscriptionId);
    // キーボードは閉じなくても以降は findScrolling で要素を辿れるため、
    // SwiftUI で失敗しがちな hideKeyboard は呼ばない（無駄なリトライ回避）。
  }

  // レコード読み取り → 件数確認 → 送信（いずれも下方なのでスクロールして探す）
  log("ネイティブ: レコード読み取り更新");
  await (await findScrolling(driver, "refresh-records-button")).click();
  const recordCount = await (await findScrolling(driver, "record-count")).getText();
  log(`ネイティブ: ${recordCount}`);

  log("ネイティブ: 未送信データを送信");
  await (await findScrolling(driver, "sync-button")).click();

  // 送信後のステータスを取得（成功/失敗のメッセージはアプリ実装に依存）
  await driver.pause(2000);
  const status = await (await findScrolling(driver, "status-message")).getText();
  log(`ネイティブ: 送信後ステータス = ${status}`);
  if (/40\d|50\d|error|失敗|エラー/i.test(status)) {
    throw new Error(`送信ステータスが異常です: ${status}`);
  }
  return { recordCount, status };
}

async function webCheck(page, phase) {
  if (!config.subscriptionId) {
    log(`Web(${phase}): IOS_TEST_SUBSCRIPTION_ID 未指定のためトップのみ確認`);
    await page.goto(`${config.webBaseUrl}/subscriptions`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /サブスク一覧/ }).first().waitFor({ timeout: config.webWaitMs });
    return;
  }
  const url = `${config.webBaseUrl}/subscriptions/${config.subscriptionId}`;
  log(`Web(${phase}): ${url} を確認`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // 詳細ページが描画されれば、その ID は送信先 DB に実在する（HTTP 500 系の取り違えを早期検知）
  await page.getByText("契約情報").first().waitFor({ timeout: config.webWaitMs });
  log(`Web(${phase}): 詳細ページ描画 OK`);
}

async function main() {
  await ensureArtifactsDir();

  let driver;
  let browser;
  let context;
  let page;
  let failed = false;
  let firstError;

  try {
    // ── Web 準備（trace 開始） ──
    browser = await chromium.launch();
    context = await browser.newContext();
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await context.newPage();

    // 事前確認: 対象サブスクが Web 側に実在するか
    await webCheck(page, "pre");

    // ── Appium セッション（インストール済みアプリを起動して操作） ──
    log("Appium セッション開始");
    driver = await remote({
      hostname: config.appiumHost,
      port: config.appiumPort,
      path: config.appiumPath,
      capabilities: appiumCapabilities(),
      logLevel: "warn",
      connectionRetryTimeout: 300000,
    });

    const nativeResult = await runNative(driver);

    // ── 送信後の Web 確認 ──
    // 集計を反映させてから詳細ページが健全に開けることを確認
    await page.request
      .post(`${config.webBaseUrl}/api/recommendations/recompute`)
      .catch((e) => log(`recompute 呼び出しは任意（失敗許容）: ${e.message}`));
    await webCheck(page, "post");

    log(`成功: native=${JSON.stringify(nativeResult)}`);
  } catch (err) {
    failed = true;
    firstError = err;
    log(`失敗: ${err?.message ?? err}`);

    // 失敗時アーティファクト: Appium スクショ
    if (driver) {
      try {
        await driver.saveScreenshot(join(config.artifactsDir, "appium-failure.png"));
        log("保存: appium-failure.png");
      } catch (e) {
        log(`スクショ保存に失敗: ${e.message}`);
      }
    }
    // 失敗時アーティファクト: Playwright trace
    if (context) {
      try {
        await context.tracing.stop({ path: join(config.artifactsDir, "playwright-trace.zip") });
        log("保存: playwright-trace.zip（npx playwright show-trace で閲覧）");
      } catch (e) {
        log(`trace 保存に失敗: ${e.message}`);
      }
    }
  } finally {
    if (!failed && context) {
      await context.tracing.stop().catch(() => {}); // 成功時は破棄
    }
    if (driver) await driver.deleteSession().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  if (failed) {
    console.error(`\n[e2e] FAILED: ${firstError?.stack ?? firstError}`);
    process.exit(1);
  }
  log("PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error(`[e2e] 予期しないエラー: ${e?.stack ?? e}`);
  process.exit(1);
});
