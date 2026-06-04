import { z } from "zod";

/**
 * スコアリングのしきい値・設定（design §5 / functional-design §8.3・§8.5）。
 *
 * 方針：判定の基準値はコードに直書きせず、ここに集約して Zod で検証する。
 * テストでは config を差し替えて判定差分を確認できる（CLAUDE.md：しきい値の設定外出し）。
 */
export const scoringConfigSchema = z
  .object({
    /** 利用ベース判定を「確定」にするのに必要な最小観測日数（登録時点から）。未満は観測中。 */
    minObservationDays: z.number().int().min(1).default(14),
    /** これ以上未使用なら強い解約候補。 */
    strongCancelUnusedDays: z.number().int().min(1).default(60),
    /** これ以上未使用なら（かつ割高なら）解約検討。 */
    considerCancelUnusedDays: z.number().int().min(1).default(30),
    /** 解約検討の対象とする月額換算の下限（最小通貨単位）。 */
    considerCancelMinAmount: z.number().int().min(0).default(1000),
    /** 直近30日の利用日数がこれ以下なら「低利用」とみなす。 */
    lowUsageMaxDays: z.number().int().min(0).default(5),
    /** importance がこれ以上なら「重要度が高い」とみなす（1..5）。 */
    highImportanceMin: z.number().int().min(1).max(5).default(4),
    /** 利用集計の対象期間（日数）。 */
    usageWindowDays: z.number().int().min(1).default(30),
    /** 更新日まで残りこの日数以下なら「更新間近」（即時の指摘）。 */
    renewalSoonDays: z.number().int().min(1).default(14),
  })
  .refine((c) => c.considerCancelUnusedDays <= c.strongCancelUnusedDays, {
    message: "considerCancelUnusedDays must be <= strongCancelUnusedDays",
    path: ["considerCancelUnusedDays"],
  });

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

/** 既定のしきい値（functional-design §8.3 の初期値）。 */
export const defaultScoringConfig: ScoringConfig = scoringConfigSchema.parse({});
