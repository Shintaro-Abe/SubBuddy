/**
 * 容量ゲート（iCloud+）：使用容量が「安全に収まる」最小の下位プランを選ぶ純粋関数。
 * steering: .steering/20260623-icloud-plus-capacity-gate/design.md §4
 *
 * 「1つ下のティア」ではなく、安全バッファ込みで収まる中で最小容量のプランを返す
 * （もっと下げられるケースを取りこぼさないため）。価格はカタログ値をそのまま使う
 * （ゲートは価格を消さない。一意でない旨は UI で「目安」と明示する）。
 */

export interface PlanCandidate {
  name: string; // 例 "50GB"
  monthlyPrice: number; // カタログ価格（目安）
  capacityGb: number; // ServicePlan.capacityGb
}

export interface CapacityBufferConfig {
  bufferGb: number;
  bufferRatio: number;
}

/** 使用量が下位プランに安全に収まるか（使用量 + バッファ ≤ プラン容量）。 */
export function fitsPlan(
  usedGb: number,
  planCapacityGb: number,
  cfg: CapacityBufferConfig,
): boolean {
  const buffer = Math.max(cfg.bufferGb, Math.round(planCapacityGb * cfg.bufferRatio));
  return usedGb + buffer <= planCapacityGb;
}

/**
 * 使用量が安全に収まる中で最小容量の下位プランを返す（無ければ null）。
 * candidates は「自分より安い有料プラン（容量つき）」を想定（無料枠は含めない）。
 */
export function smallestFittingPlan(
  usedGb: number,
  candidates: PlanCandidate[],
  cfg: CapacityBufferConfig,
): PlanCandidate | null {
  const fitting = candidates.filter((p) => fitsPlan(usedGb, p.capacityGb, cfg));
  if (fitting.length === 0) return null;
  return fitting.reduce((min, p) => (p.capacityGb < min.capacityGb ? p : min));
}
