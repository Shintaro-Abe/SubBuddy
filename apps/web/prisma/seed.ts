/**
 * 合成（ダミー）データ seed。実 PII は一切使わない（CLAUDE.md PII 方針）。
 * 目的：各レコメンド判定と「観測中（§8.5）」が再現できるシナリオを用意する。
 *
 * シナリオ（subscriptions）:
 *  1. AIツールX            → 60日以上未使用            → strong_cancel_candidate
 *  2. ニュースProリーダー    → 30日以上未使用 × 月1,000円超 → consider_cancel
 *  3/4. 音楽2契約（重複）    → 低利用側を consider_cancel
 *  5. 学習サブスク          → 低利用だが importance 高   → review（様子見）
 *  6. iCloud+ 200GB        → 容量ベース（consider_downgrade のルール枠）
 *  7. 動画見放題            → 十分利用                  → keep
 *  8. 新規登録サービス       → 登録直後・観測中（あと N 日）
 */
import { PrismaClient, BillingCycle, UsageBucket } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

/** n 日前の Date を返す。 */
function daysAgo(n: number): Date {
  return new Date(now.getTime() - n * DAY_MS);
}
/** n 日後の Date（更新日用）。 */
function daysAhead(n: number): Date {
  return new Date(now.getTime() + n * DAY_MS);
}

async function main() {
  // 冪等な再 seed のため既存を削除（合成データのみ）。
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.iosUsageDailySummary.deleteMany();
  await prisma.billingEvent.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.serviceAlternative.deleteMany();
  await prisma.servicePlan.deleteMany();
  await prisma.serviceCatalog.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { id: "user_local", name: "ローカルユーザー（合成）" },
  });

  // --- service_catalog：除外対象（Apple 系） ---
  await prisma.serviceCatalog.createMany({
    data: [
      { canonicalName: "Apple Music", category: "music", isExcluded: true, commonAliases: "アップルミュージック" },
      { canonicalName: "Apple TV+", category: "video_streaming", isExcluded: true },
      { canonicalName: "Apple Arcade", category: "game", isExcluded: true },
      { canonicalName: "Apple One", category: "bundle", isExcluded: true },
    ],
  });

  // --- service_catalog：知識ベース（service-catalog.json から投入） ---
  interface CatalogEntry {
    canonicalName: string;
    category: string;
    usageType: string;
    commonAliases: string;
    plans: { name: string; monthlyPrice: number; isFreeTier: boolean }[];
    alternatives: string[];
  }
  const catalogPath = join(__dirname, "seed", "service-catalog.json");
  const catalog: CatalogEntry[] = JSON.parse(readFileSync(catalogPath, "utf-8"));
  const serviceIdMap = new Map<string, string>();

  for (const entry of catalog) {
    const service = await prisma.serviceCatalog.create({
      data: {
        canonicalName: entry.canonicalName,
        category: entry.category,
        usageType: entry.usageType,
        commonAliases: entry.commonAliases,
      },
    });
    serviceIdMap.set(entry.canonicalName, service.id);

    if (entry.plans.length > 0) {
      await prisma.servicePlan.createMany({
        data: entry.plans.map((p) => ({
          serviceId: service.id,
          name: p.name,
          monthlyPrice: p.monthlyPrice,
          isFreeTier: p.isFreeTier,
          verifiedAt: now,
        })),
      });
    }
  }

  // 代替関係の投入（双方向ではなく from→to の片方向）
  for (const entry of catalog) {
    const fromId = serviceIdMap.get(entry.canonicalName);
    if (!fromId || entry.alternatives.length === 0) continue;
    const altData = entry.alternatives
      .map((altName) => {
        const toId = serviceIdMap.get(altName);
        return toId ? { fromServiceId: fromId, toServiceId: toId } : null;
      })
      .filter((d): d is { fromServiceId: string; toServiceId: string } => d !== null);
    if (altData.length > 0) {
      await prisma.serviceAlternative.createMany({ data: altData });
    }
  }

  // --- subscriptions（合成）---
  // helper：サブスクと利用サマリ（直近 days 日のうち usedDays 日を used=true）を作る
  async function addUsage(
    subscriptionId: string,
    opts: { windowDays: number; usedDays: number; bucket: UsageBucket; lastUsedDaysAgo?: number },
  ) {
    const rows: {
      userId: string;
      subscriptionId: string;
      usageDate: Date;
      used: boolean;
      usageBucket: UsageBucket;
    }[] = [];
    // 直近 windowDays 日ぶん、usedDays 日を「最終利用日(lastUsedDaysAgo)」より前に分布させる
    const start = opts.lastUsedDaysAgo ?? 0;
    let placed = 0;
    for (let d = start; d < opts.windowDays + start && placed < opts.usedDays; d++) {
      rows.push({
        userId: user.id,
        subscriptionId,
        usageDate: daysAgo(d),
        used: true,
        usageBucket: opts.bucket,
      });
      placed++;
    }
    if (rows.length > 0) {
      await prisma.iosUsageDailySummary.createMany({ data: rows });
    }
  }

  // 1. 強い解約候補（60日以上未使用・観測十分）
  const aiTool = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "AIツールX",
      normalizedName: "AIツールX",
      category: "ai",
      amount: 3000,
      billingCycle: BillingCycle.monthly,
      importance: 2,
      nextRenewalDate: daysAhead(20),
      createdAt: daysAgo(120),
      cancellationUrl: "https://example.com/cancel/ai-tool-x",
    },
  });
  // 利用は 65 日以上前に少しだけ → 直近は未使用
  await addUsage(aiTool.id, {
    windowDays: 5,
    usedDays: 3,
    bucket: UsageBucket.m15_plus,
    lastUsedDaysAgo: 65,
  });

  // 2. 解約検討（30日以上未使用 × 月1,000円超・観測十分）
  const news = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "ニュースProリーダー",
      normalizedName: "ニュースProリーダー",
      category: "news",
      amount: 1480,
      billingCycle: BillingCycle.monthly,
      importance: 3,
      nextRenewalDate: daysAhead(10),
      createdAt: daysAgo(90),
      cancellationUrl: "https://example.com/cancel/news-pro",
    },
  });
  await addUsage(news.id, {
    windowDays: 10,
    usedDays: 4,
    bucket: UsageBucket.m5_plus,
    lastUsedDaysAgo: 35,
  });

  // 3/4. 音楽カテゴリ重複（片方低利用）
  const musicMain = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "Amazon Music",
      normalizedName: "Amazon Music",
      category: "music",
      amount: 1080,
      billingCycle: BillingCycle.monthly,
      importance: 4,
      nextRenewalDate: daysAhead(25),
      createdAt: daysAgo(200),
      cancellationUrl: "https://example.com/cancel/amazon-music",
    },
  });
  await addUsage(musicMain.id, { windowDays: 30, usedDays: 24, bucket: UsageBucket.m60_plus });

  const musicSub = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "Spotify",
      normalizedName: "Spotify",
      category: "music",
      amount: 980,
      billingCycle: BillingCycle.monthly,
      importance: 2,
      nextRenewalDate: daysAhead(18),
      createdAt: daysAgo(180),
      cancellationUrl: "https://example.com/cancel/spotify",
    },
  });
  await addUsage(musicSub.id, {
    windowDays: 30,
    usedDays: 2,
    bucket: UsageBucket.m5_plus,
    lastUsedDaysAgo: 6,
  });

  // 5. 様子見（低利用だが importance 高）
  const learning = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "学習サブスク",
      normalizedName: "学習サブスク",
      category: "education",
      amount: 1980,
      billingCycle: BillingCycle.monthly,
      importance: 5,
      nextRenewalDate: daysAhead(40),
      createdAt: daysAgo(75),
      cancellationUrl: "https://example.com/cancel/learning",
    },
  });
  await addUsage(learning.id, {
    windowDays: 30,
    usedDays: 3,
    bucket: UsageBucket.m15_plus,
    lastUsedDaysAgo: 4,
  });

  // 6. iCloud+ 容量ベース（consider_downgrade のルール枠。容量データは今回未投入）
  const icloud = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "iCloud+ 200GB",
      normalizedName: "iCloud+",
      category: "storage",
      amount: 400,
      billingCycle: BillingCycle.monthly,
      importance: 3,
      nextRenewalDate: daysAhead(5),
      createdAt: daysAgo(300),
      cancellationUrl: "https://example.com/cancel/icloud",
    },
  });

  // 7. 継続（十分利用）
  const video = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "動画見放題",
      normalizedName: "動画見放題",
      category: "video",
      amount: 2200,
      billingCycle: BillingCycle.monthly,
      importance: 4,
      nextRenewalDate: daysAhead(22),
      createdAt: daysAgo(150),
      cancellationUrl: "https://example.com/cancel/video",
    },
  });
  await addUsage(video.id, { windowDays: 30, usedDays: 26, bucket: UsageBucket.m120_plus });

  // 8. 観測中（登録直後・利用履歴ゼロ）
  await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "新規登録サービス",
      normalizedName: "新規登録サービス",
      category: "video",
      amount: 980,
      billingCycle: BillingCycle.monthly,
      importance: 3,
      nextRenewalDate: daysAhead(28),
      createdAt: daysAgo(3),
      cancellationUrl: "https://example.com/cancel/new-service",
    },
  });

  // --- billing_events（合成・手動由来）---
  for (const sub of [aiTool, news, musicMain, musicSub, learning, icloud, video]) {
    await prisma.billingEvent.create({
      data: {
        userId: user.id,
        subscriptionId: sub.id,
        amount: sub.amount,
        billingCycle: BillingCycle.monthly,
        chargedAt: daysAgo(15),
        source: "manual",
        serviceNameRaw: sub.name,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    subscriptions: await prisma.subscription.count(),
    usage: await prisma.iosUsageDailySummary.count(),
    billing: await prisma.billingEvent.count(),
    catalog: await prisma.serviceCatalog.count(),
  };
  console.log("seed done (synthetic only):", counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
