import { execSync } from "node:child_process";

/**
 * E2E 前に合成データを投入し直し、判定の前提を決定的にする。
 * 実 PII は扱わない（seed は合成データのみ）。Prisma が .env を読み込むため環境変数の明示は不要。
 */
export default async function globalSetup() {
  execSync("npm run db:seed", { stdio: "inherit" });
}
