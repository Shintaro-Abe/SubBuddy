import { describe, expect, it } from "vitest";
import { fitsPlan, smallestFittingPlan, type PlanCandidate } from "./fit";

const cfg = { bufferGb: 5, bufferRatio: 0.1 };

describe("fitsPlan", () => {
  it("使用量＋バッファが容量以内なら収まる", () => {
    // 50GBプラン：バッファ = max(5, 50*0.1=5) = 5 → 45GBまで収まる
    expect(fitsPlan(40, 50, cfg)).toBe(true);
    expect(fitsPlan(45, 50, cfg)).toBe(true);
  });

  it("バッファ込みで超えると収まらない", () => {
    expect(fitsPlan(46, 50, cfg)).toBe(false);
    expect(fitsPlan(50, 50, cfg)).toBe(false);
  });

  it("大容量プランでは割合バッファが効く", () => {
    // 200GB：バッファ = max(5, 20) = 20 → 180GBまで
    expect(fitsPlan(180, 200, cfg)).toBe(true);
    expect(fitsPlan(181, 200, cfg)).toBe(false);
  });
});

describe("smallestFittingPlan", () => {
  const candidates: PlanCandidate[] = [
    { name: "50GB", monthlyPrice: 130, capacityGb: 50 },
    { name: "200GB", monthlyPrice: 400, capacityGb: 200 },
  ];

  it("収まる中で最小容量のプランを選ぶ", () => {
    // 38GB → 50GB に収まる（最小）
    expect(smallestFittingPlan(38, candidates, cfg)?.name).toBe("50GB");
  });

  it("最小プランに収まらなければ次に小さい収まるプランを選ぶ", () => {
    // 120GB → 50GBは不可、200GBに収まる
    expect(smallestFittingPlan(120, candidates, cfg)?.name).toBe("200GB");
  });

  it("どれにも収まらなければ null", () => {
    expect(smallestFittingPlan(500, candidates, cfg)).toBeNull();
  });

  it("候補が空なら null", () => {
    expect(smallestFittingPlan(10, [], cfg)).toBeNull();
  });
});
