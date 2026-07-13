import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const confirmation = process.env.CONFIRM_CREATE_DEV_SUBSCRIPTION;
const subscriptionId = process.env.SUBBUDDY_DEV_SUBSCRIPTION_ID ?? "sub_dev_netflix_001";
const subscriptionName = process.env.SUBBUDDY_DEV_SUBSCRIPTION_NAME ?? "Netflix";
const amount = Number(process.env.SUBBUDDY_DEV_SUBSCRIPTION_AMOUNT ?? "2290");
const targetUserId = process.env.SUBBUDDY_DEV_USER_ID;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function resolveUserId() {
  if (targetUserId) return targetUserId;

  const latestDevice = await prisma.device.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, createdAt: true },
  });

  if (!latestDevice) {
    throw new Error("devices に行がありません。先にiPhoneアプリでデバイス登録してください。");
  }

  console.log(`latest device: ${latestDevice.id} (${latestDevice.createdAt.toISOString()})`);
  return latestDevice.userId;
}

async function main() {
  if (confirmation !== "1") {
    fail("安全確認のため CONFIRM_CREATE_DEV_SUBSCRIPTION=1 を付けて実行してください。");
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    fail("SUBBUDDY_DEV_SUBSCRIPTION_AMOUNT は正の整数にしてください。");
    return;
  }

  const userId = await resolveUserId();
  const existing = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, userId: true, name: true },
  });

  if (existing && existing.userId !== userId) {
    fail(
      `subscription id ${subscriptionId} は別userに存在します。SUBBUDDY_DEV_SUBSCRIPTION_IDを変えてください。`,
    );
    return;
  }

  const subscription = await prisma.subscription.upsert({
    where: { id: subscriptionId },
    create: {
      id: subscriptionId,
      userId,
      name: subscriptionName,
      normalizedName: subscriptionName,
      category: "video_streaming",
      amount,
      currency: "JPY",
      billingCycle: "monthly",
      status: "active",
      importance: 4,
      usageType: "active_foreground",
    },
    update: {
      name: subscriptionName,
      normalizedName: subscriptionName,
      category: "video_streaming",
      amount,
      currency: "JPY",
      billingCycle: "monthly",
      status: "active",
      importance: 4,
      usageType: "active_foreground",
    },
    select: { id: true, userId: true, name: true, createdAt: true, updatedAt: true },
  });

  console.log("開発用サブスクを用意しました。");
  console.log(`Subscription ID: ${subscription.id}`);
  console.log(`Name: ${subscription.name}`);
  console.log(`User ID: ${subscription.userId}`);
}

main()
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
