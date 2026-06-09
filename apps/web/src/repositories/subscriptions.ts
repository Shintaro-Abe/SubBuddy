import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SubscriptionCreateInput, SubscriptionUpdateInput } from "@/schemas/subscription";

/**
 * subscriptions の永続化（design §3 / functional-design §5）。
 * DB アクセスはここに集約し、ドメイン・API から Prisma を直接呼ばない。
 * テスト容易性のため Prisma クライアントを引数で差し替え可能にする。
 */
type Db = Pick<PrismaClient, "subscription">;

/** YYYY-MM-DD（任意）を Date（UTC0時）に変換。未指定は null。 */
function toRenewalDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function listSubscriptions(userId: string, db: Db = prisma) {
  return db.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export function getSubscription(userId: string, id: string, db: Db = prisma) {
  return db.subscription.findFirst({ where: { id, userId } });
}

export function createSubscription(
  userId: string,
  input: SubscriptionCreateInput,
  db: Db = prisma,
) {
  const data: Prisma.SubscriptionUncheckedCreateInput = {
    userId,
    name: input.name,
    category: input.category,
    amount: input.amount,
    currency: input.currency,
    billingCycle: input.billingCycle,
    nextRenewalDate: toRenewalDate(input.nextRenewalDate),
    importance: input.importance,
    cancellationUrl: input.cancellationUrl ?? null,
    notes: input.notes ?? null,
    signupChannel: input.signupChannel ?? null,
    status: input.status,
    matchedServiceId: input.matchedServiceId ?? null,
    usageType: input.usageType ?? "active_foreground",
    initialValueAnswer: input.initialValueAnswer ?? null,
  };
  return db.subscription.create({ data });
}

export async function updateSubscription(
  userId: string,
  id: string,
  input: SubscriptionUpdateInput,
  db: Db = prisma,
) {
  // 他ユーザーの行を更新しないよう所有権を確認してから更新する。
  const existing = await db.subscription.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const data: Prisma.SubscriptionUncheckedUpdateInput = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.amount !== undefined && { amount: input.amount }),
    ...(input.currency !== undefined && { currency: input.currency }),
    ...(input.billingCycle !== undefined && { billingCycle: input.billingCycle }),
    ...(input.nextRenewalDate !== undefined && {
      nextRenewalDate: toRenewalDate(input.nextRenewalDate),
    }),
    ...(input.importance !== undefined && { importance: input.importance }),
    ...(input.cancellationUrl !== undefined && { cancellationUrl: input.cancellationUrl }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.signupChannel !== undefined && { signupChannel: input.signupChannel }),
    ...(input.status !== undefined && { status: input.status }),
  };
  return db.subscription.update({ where: { id }, data });
}

export async function deleteSubscription(userId: string, id: string, db: Db = prisma) {
  const existing = await db.subscription.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await db.subscription.delete({ where: { id } });
  return true;
}
