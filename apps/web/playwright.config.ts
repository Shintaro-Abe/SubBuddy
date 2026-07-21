import { defineConfig, devices } from "@playwright/test";

/**
 * E2E（主要導線1本）。合成データ前提で、実 PII は扱わない。
 * - globalSetup で合成 seed を投入し、判定の前提を決定的にする。
 * - webServer は専用ポート 3200 で dev サーバを起動（既存の手動サーバと衝突しない）。
 */
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  // dev サーバはルート初回アクセス時にコンパイルが走るため、待ち時間を厚めに取る。
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // 本番ビルドに対して実行する（dev の HMR はハイドレーションが不安定で入力が失われるため）。
  // ビルドは npm スクリプト test:e2e 側で先に実行する前提。
  webServer: {
    command: `npm run start`,
    url: `http://127.0.0.1:${PORT}`,
    env: {
      PORT: String(PORT),
      // E2E は合成データを使うローカル構成で固定する。
      // 呼び出し元の環境変数に影響されず、安全な認証設定で起動するため明示する。
      SUBBUDDY_MODE: "local",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
