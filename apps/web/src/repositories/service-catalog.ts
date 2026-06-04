import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * service_catalog の参照（正規化辞書・除外サービス）。design §3。
 */
type Db = Pick<PrismaClient, "serviceCatalog">;

export function listServiceCatalog(db: Db = prisma) {
  return db.serviceCatalog.findMany({ orderBy: { canonicalName: "asc" } });
}
