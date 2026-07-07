// 今日のサーバー実装をローカル実DBで通し検証する（合成データ専用・PII なし）。
// 検証項目:
//  1. デバイス登録の冪等 upsert（同じ clientDeviceId は 1 レコード）
//  2. 利用量の max マージ（後勝ちにしない）
//  3. アカウント削除のカスケード物理削除
//  4. テナント越え防止（他 user のサブスクには書けない）
// 使い方: node --env-file=.env scripts/verify-cloud-apis.mjs
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { upsertUsageDailyBatch } from "../src/repositories/usage.ts";
import { deleteAppleUserAccount, registerDeviceForAppleUser } from "../src/services/auth.ts";

const prisma = new PrismaClient();
const TAG = `verify_${randomUUID().slice(0, 8)}`;
let failures = 0;

function check(name, cond, detail = "") {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures += 1;
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function makeUser(suffix) {
  return prisma.user.create({
    data: { name: `${TAG}_${suffix}`, appleSubjectHash: `${TAG}_${suffix}_hash` },
    select: { id: true, appleSubjectHash: true },
  });
}

async function makeSubscription(userId, name) {
  return prisma.subscription.create({
    data: {
      userId,
      name,
      category: "other",
      amount: 1000,
      billingCycle: "monthly",
    },
    select: { id: true },
  });
}

async function main() {
  const userA = await makeUser("a");
  const userB = await makeUser("b");
  const subA = await makeSubscription(userA.id, `${TAG}_subA`);
  const subB = await makeSubscription(userB.id, `${TAG}_subB`);

  // 1. デバイス冪等 upsert
  const clientDeviceId = randomUUID();
  const first = await registerDeviceForAppleUser(userA.id, "iPhone", clientDeviceId, prisma);
  const second = await registerDeviceForAppleUser(
    userA.id,
    "iPhone (renamed)",
    clientDeviceId,
    prisma,
  );
  const deviceCount = await prisma.device.count({ where: { userId: userA.id } });
  check("device upsert は同一 clientDeviceId で 1 レコード", deviceCount === 1, `count=${deviceCount}`);
  check("device upsert は同じ id を返す", first.device.id === second.device.id);
  check("device token は再発行される", first.deviceSyncToken !== second.deviceSyncToken);

  // 2. 利用量 max マージ
  const usageDate = new Date("2026-06-01T00:00:00.000Z");
  await upsertUsageDailyBatch(
    userA.id,
    [
      {
        subscriptionId: subA.id,
        usageDate,
        used: true,
        usageBucket: "m60_plus",
        estimatedMinutesMin: 60,
        estimatedMinutesMax: 119,
        source: "ios_device_activity",
      },
    ],
    prisma,
  );
  // 小さいバケットを後から送っても下がらない
  await upsertUsageDailyBatch(
    userA.id,
    [
      {
        subscriptionId: subA.id,
        usageDate,
        used: false,
        usageBucket: "m15_plus",
        estimatedMinutesMin: 15,
        estimatedMinutesMax: 29,
        source: "manual_synthetic",
      },
    ],
    prisma,
  );
  const rowAfterLower = await prisma.iosUsageDailySummary.findUnique({
    where: { subscriptionId_usageDate: { subscriptionId: subA.id, usageDate } },
  });
  check(
    "max マージ: 小さいバケット後送でも下がらない",
    rowAfterLower.usageBucket === "m60_plus",
    `bucket=${rowAfterLower.usageBucket}`,
  );
  check("max マージ: used は OR で true 維持", rowAfterLower.used === true);
  check(
    "max マージ: 分推定は最大維持",
    rowAfterLower.estimatedMinutesMax === 119,
    `max=${rowAfterLower.estimatedMinutesMax}`,
  );
  // 大きいバケットは上がる
  await upsertUsageDailyBatch(
    userA.id,
    [
      {
        subscriptionId: subA.id,
        usageDate,
        used: false,
        usageBucket: "m120_plus",
        estimatedMinutesMin: 120,
        estimatedMinutesMax: null,
        source: "ios_device_activity",
      },
    ],
    prisma,
  );
  const rowAfterHigher = await prisma.iosUsageDailySummary.findUnique({
    where: { subscriptionId_usageDate: { subscriptionId: subA.id, usageDate } },
  });
  check(
    "max マージ: 大きいバケットは上がる",
    rowAfterHigher.usageBucket === "m120_plus",
    `bucket=${rowAfterHigher.usageBucket}`,
  );
  const rowCount = await prisma.iosUsageDailySummary.count({
    where: { subscriptionId: subA.id, usageDate },
  });
  check("max マージ: 冪等（行は増えない）", rowCount === 1, `count=${rowCount}`);

  // 3. テナント越え防止（userA のトークン相当で userB のサブスクへは書けない）
  let crossTenantBlocked = false;
  try {
    await upsertUsageDailyBatch(
      userA.id,
      [
        {
          subscriptionId: subB.id,
          usageDate,
          used: true,
          usageBucket: "m30_plus",
          estimatedMinutesMin: 30,
          estimatedMinutesMax: 59,
          source: "ios_device_activity",
        },
      ],
      prisma,
    );
  } catch (e) {
    crossTenantBlocked = e?.name === "UsageSubscriptionNotFoundError";
  }
  check("テナント越え: 他 user のサブスクには書けない", crossTenantBlocked);
  const subBUsage = await prisma.iosUsageDailySummary.count({ where: { subscriptionId: subB.id } });
  check("テナント越え: 他 user データは作られていない", subBUsage === 0, `count=${subBUsage}`);

  // 4. アカウント削除カスケード
  const deleted = await deleteAppleUserAccount({ subjectHash: userA.appleSubjectHash }, prisma);
  check("アカウント削除: 成功を返す", deleted === true);
  const remUser = await prisma.user.count({ where: { id: userA.id } });
  const remSub = await prisma.subscription.count({ where: { userId: userA.id } });
  const remDev = await prisma.device.count({ where: { userId: userA.id } });
  const remUsage = await prisma.iosUsageDailySummary.count({ where: { userId: userA.id } });
  check("アカウント削除: user 消滅", remUser === 0);
  check("アカウント削除: subscription カスケード", remSub === 0, `count=${remSub}`);
  check("アカウント削除: device カスケード", remDev === 0, `count=${remDev}`);
  check("アカウント削除: usage カスケード", remUsage === 0, `count=${remUsage}`);
  const userBStillThere = await prisma.user.count({ where: { id: userB.id } });
  check("アカウント削除: 他 user は残る", userBStillThere === 1);

  // 後始末（userB とその合成データ）
  await prisma.user.deleteMany({ where: { id: userB.id } });

  console.log("");
  if (failures > 0) {
    console.error(`検証失敗: ${failures} 件`);
    process.exitCode = 1;
  } else {
    console.log("すべての検証項目が PASS");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
