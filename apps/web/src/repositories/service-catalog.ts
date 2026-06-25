import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * service_catalog の参照（正規化辞書・除外サービス）。design §3。
 */
type Db = Pick<PrismaClient, "serviceCatalog">;

export function listServiceCatalog(db: Db = prisma) {
  return db.serviceCatalog.findMany({ orderBy: { canonicalName: "asc" } });
}

type PlanDb = Pick<PrismaClient, "servicePlan">;

/**
 * 契約中プランの容量(GB)を「登録情報（金額→カタログ）」から導出する。
 * 容量パネルでプランを再入力させず、登録を唯一の出所にするための関数。
 * matchedServiceId の有料プラン（容量つき）のうち、月額が指定額に最も近いものの
 * capacityGb を返す。マッチ無し（カタログ未連携・容量つきプラン無し）は null。
 * 判定には使わず、表示（使用率バー）と確定文言の具体化にのみ用いる。
 */
export async function getCurrentPlanCapacityGb(
  matchedServiceId: string | null | undefined,
  monthlyAmount: number,
  db: PlanDb = prisma,
): Promise<number | null> {
  if (!matchedServiceId) return null;
  const plans = await db.servicePlan.findMany({
    where: { serviceId: matchedServiceId, isFreeTier: false, capacityGb: { not: null } },
  });
  if (plans.length === 0) return null;
  let best = plans[0];
  for (const p of plans) {
    if (Math.abs(p.monthlyPrice - monthlyAmount) < Math.abs(best.monthlyPrice - monthlyAmount)) {
      best = p;
    }
  }
  return best.capacityGb;
}
