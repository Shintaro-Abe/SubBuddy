// デモ用：利用量を API に送って判定が変わる様子を見せるスクリプト（合成データのみ）。
//
// 使い方（apps/web ディレクトリで）:
//   node --env-file=.env scripts/demo-send-usage.mjs [サブスク名] [日数]
//   例: node --env-file=.env scripts/demo-send-usage.mjs "AIツールX" 14
//
// 動作：指定サブスクの現在の判定を表示 → 直近N日に「使った」利用量を送信 → 再計算 → 新しい判定を表示。
// 認証は USAGE_SYNC_TOKEN（.env）。本物の API（POST /api/usage/daily, /api/recommendations/recompute）を叩く。

import { PrismaClient } from "@prisma/client";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.USAGE_SYNC_TOKEN;
const NAME = process.argv[2] ?? "AIツールX";
const DAYS = Number(process.argv[3] ?? 14);

const prisma = new PrismaClient();

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

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
  if (!TOKEN) {
    console.error("✗ USAGE_SYNC_TOKEN が未設定です（.env を確認、--env-file=.env で実行）");
    process.exit(1);
  }

  const sub = await prisma.subscription.findFirst({ where: { name: NAME } });
  if (!sub) {
    console.error(`✗ サブスク「${NAME}」が見つかりません`);
    process.exit(1);
  }

  console.log(`\n■ 対象：${sub.name}（${sub.usageType}）`);
  console.log(`  送信前：${showDecision(await latestSnapshot(sub.id))}`);

  // 直近 DAYS 日に「使った（30分以上）」を送る
  const items = [];
  for (let i = 0; i < DAYS; i++) {
    items.push({
      subscriptionId: sub.id,
      date: isoDaysAgo(i),
      used: true,
      usageBucket: "30m_plus",
      estimatedMinutesMin: 30,
      estimatedMinutesMax: 60,
      source: "manual_synthetic",
    });
  }

  console.log(`\n→ 利用量を送信中…（直近${DAYS}日「使った」 ${items.length}件）`);
  const sync = await fetch(`${BASE}/api/usage/daily`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ items }),
  });
  console.log(`  POST /api/usage/daily → HTTP ${sync.status} ${JSON.stringify(await sync.json())}`);

  console.log(`\n→ 判定を再計算中…`);
  const rec = await fetch(`${BASE}/api/recommendations/recompute`, { method: "POST" });
  console.log(`  POST /api/recommendations/recompute → HTTP ${rec.status}`);

  console.log(`\n  送信後：${showDecision(await latestSnapshot(sub.id))}`);
  console.log(`\n✓ 画面（${BASE}/subscriptions/${sub.id}）を再読み込みすると判定が変わっています。\n`);
}

main()
  .catch((e) => {
    console.error("✗ エラー:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
