import type { GuidanceMeasurementChoice, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GuidanceProgressRecord = {
  inventoryCompletedAt: Date | null;
  spendingViewedAt: Date | null;
  reviewViewedAt: Date | null;
  measurementChoice: GuidanceMeasurementChoice;
  completedAt: Date | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getGuidanceProgressRecord(
  userId: string,
  db: DbClient = prisma,
): Promise<GuidanceProgressRecord | null> {
  return db.userGuidanceProgress.findUnique({
    where: { userId },
    select: {
      inventoryCompletedAt: true,
      spendingViewedAt: true,
      reviewViewedAt: true,
      measurementChoice: true,
      completedAt: true,
    },
  });
}

export async function countUserSubscriptions(
  userId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.subscription.count({ where: { userId } });
}

export async function upsertGuidanceProgressRecord(
  userId: string,
  update: Prisma.UserGuidanceProgressUncheckedUpdateInput,
  create: Prisma.UserGuidanceProgressUncheckedCreateInput,
  db: DbClient = prisma,
): Promise<GuidanceProgressRecord> {
  return db.userGuidanceProgress.upsert({
    where: { userId },
    update,
    create,
    select: {
      inventoryCompletedAt: true,
      spendingViewedAt: true,
      reviewViewedAt: true,
      measurementChoice: true,
      completedAt: true,
    },
  });
}
