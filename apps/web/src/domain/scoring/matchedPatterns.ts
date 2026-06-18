import type { MatchedPattern } from "./computeRecommendation";

/**
 * DB（jsonb）から読み出した値を MatchedPattern[] に安全へ復元する。
 * 後方互換：列が無い時期の行は null、観測中で根拠なしは null/空配列のことがある。
 * 壊れたデータでも例外を投げず、形が正しい要素だけを通す。
 */

const VALID_PATTERNS = new Set(["P1", "P2", "P3", "P4", "P5", "P6"]);

function isMatchedPattern(value: unknown): value is MatchedPattern {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.pattern === "string" &&
    VALID_PATTERNS.has(v.pattern) &&
    typeof v.label === "string" &&
    typeof v.evidence === "string" &&
    (v.caveat === undefined || typeof v.caveat === "string")
  );
}

export function parseMatchedPatterns(value: unknown): MatchedPattern[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isMatchedPattern).map((p) => ({
    pattern: p.pattern,
    label: p.label,
    evidence: p.evidence,
    ...(p.caveat !== undefined ? { caveat: p.caveat } : {}),
  }));
}
