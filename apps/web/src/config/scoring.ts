import { z } from "zod";

/**
 * パターン判定のしきい値・設定。
 * steering: .steering/20260609-quantitative-recommendation-engine/design.md §6
 *
 * 方針：判定の基準値はコードに直書きせず、ここに集約して Zod で検証する。
 * テストでは config を差し替えて判定差分を確認できる（CLAUDE.md：しきい値の設定外出し）。
 */
export const scoringConfigSchema = z.object({
  /** P1 の利用判定を確定にするのに必要な最小観測日数。 */
  minObservationDays: z.number().int().min(1).default(14),

  /** P1：最終利用からこの日数以上で様子見。 */
  p1WatchLastUseDays: z.number().int().min(1).default(31),
  /** P1：最終利用からこの日数以上＋スパン内利用0日で解約検討。 */
  p1CancelLastUseDays: z.number().int().min(1).default(61),

  /** P5：年額更新まで残りこの日数以下で「更新が近い」。 */
  renewalSoonDays: z.number().int().min(1).default(7),

  /** P6：月額換算がこの金額以上で「高額」。 */
  highCostThreshold: z.number().int().min(0).default(2000),
  /** P6：契約がこの月数以上で「長期」。 */
  longContractMonths: z.number().int().min(1).default(12),

  /** 知識ベースの料金が古いとみなす日数。 */
  knowledgeBaseStaleDays: z.number().int().min(1).default(180),
  /** 陳腐化時の信頼度係数（0〜1）。 */
  staleConfidenceMultiplier: z.number().min(0).max(1).default(0.7),

  /** 容量ゲート（iCloud+）：使用容量がこの日数以内に確認されていれば鮮度OK。 */
  capacityFreshnessDays: z.number().int().min(1).default(30),
  /** 容量ゲート：安全バッファの下限GB。 */
  capacitySafetyBufferGb: z.number().int().min(0).default(5),
  /** 容量ゲート：下位プラン容量に対する安全バッファ割合（0〜1）。 */
  capacitySafetyBufferRatio: z.number().min(0).max(1).default(0.1),
});

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export const defaultScoringConfig: ScoringConfig = scoringConfigSchema.parse({});
