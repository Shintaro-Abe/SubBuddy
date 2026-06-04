import { PrismaClient } from "@prisma/client";

/**
 * Prisma クライアントの共有インスタンス。
 * Next.js の開発時ホットリロードで接続が増殖しないよう globalThis に保持する。
 * 実 DB アクセスはリポジトリ層（src/repositories）からのみ行う（design §1）。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
