/**
 * 金額は最小通貨単位の整数で保持する（浮動小数で持たない）。
 * 月額換算など、表示・判定で共通利用するユーティリティ。
 */

export type BillingCycle = "monthly" | "yearly";

/**
 * 課金周期にかかわらず「月額換算」を整数で返す。
 * 年額は 12 で割り、端数は四捨五入（最小通貨単位での近似）。
 */
export function toMonthlyAmount(amount: number, cycle: BillingCycle): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`amount must be a non-negative integer: ${amount}`);
  }
  return cycle === "yearly" ? Math.round(amount / 12) : amount;
}

/** 月額から年額換算（整数）。 */
export function toYearlyAmount(amount: number, cycle: BillingCycle): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`amount must be a non-negative integer: ${amount}`);
  }
  return cycle === "yearly" ? amount : amount * 12;
}
