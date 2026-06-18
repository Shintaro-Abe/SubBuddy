// デモ用：demo:usage で投入した利用量を取り消し、判定を元に戻すスクリプト（合成データのみ）。
//
// 使い方（apps/web ディレクトリで）:
//   npm run demo:revert            … 既定「AIツールX」を元に戻す
//   npm run demo:revert -- "Spotify"   … 対象を指定
//
// 動作：指定サブスクの現在の判定を表示 → demo:usage が入れた利用量(source="manual_synthetic")
//       だけを削除 → 再計算 → 元の判定に戻ったことを表示。
// seed の利用量(source="ios_device_activity")には一切触れないので、対象・日数に依存せず安全。

import { PrismaClient } from "@prisma/client";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const NAME = process.argv[2] ?? "AIツールX";

const prisma = new PrismaClient();

function showDecision(snap) {
  if (!snap) return "（まだ判定なし）";
  const labels = Array.isArray(snap.matchedPatterns)
    ? snap.matchedPatterns.map((p) => p.label).join(", ")
    : "";
  const status = snap.dataStatus === "observing" ? "観測中" : "確定";
  return `判定=${snap.decision ?? "なし"} / 状態=${status} / 根拠=[${labels}]`;
}

async function latestSnapshot(subscriptionId) {
  return prisma.recommendationSnapshot.findFirst({
    where: { subscriptionId },
    orderBy: { generatedAt: "desc" },
  });
}

async function main() {
  const sub = await prisma.subscription.findFirst({ where: { name: NAME } });
  if (!sub) {
    console.error(`✗ サブスク「${NAME}」が見つかりません`);
    process.exit(1);
  }

  console.log(`\n■ 対象：${sub.name}`);
  console.log(`  取り消し前：${showDecision(await latestSnapshot(sub.id))}`);

  // demo:usage が入れた行（合成・手動）だけを削除。seed 由来の利用量は残す。
  const del = await prisma.iosUsageDailySummary.deleteMany({
    where: { subscriptionId: sub.id, source: "manual_synthetic" },
  });
  console.log(`\n→ デモ投入の利用量を削除：${del.count} 件（source=manual_synthetic のみ）`);

  console.log(`\n→ 判定を再計算中…`);
  const rec = await fetch(`${BASE}/api/recommendations/recompute`, { method: "POST" });
  console.log(`  POST /api/recommendations/recompute → HTTP ${rec.status}`);

  console.log(`\n  取り消し後：${showDecision(await latestSnapshot(sub.id))}`);
  console.log(`\n✓ 画面（${BASE}/subscriptions/${sub.id}）を再読み込みすると判定が元に戻っています。\n`);
}

main()
  .catch((e) => {
    console.error("✗ エラー:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
