import { describe, it, expect } from "vitest";
import { verifyUsageSyncToken } from "./usage-auth";

describe("verifyUsageSyncToken", () => {
  const TOKEN = "synthetic-test-token-for-unit-tests";

  it("トークンが一致すれば true", () => {
    expect(verifyUsageSyncToken(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("環境変数未設定（undefined/空文字）なら常に false（フェイルクローズ）", () => {
    expect(verifyUsageSyncToken(`Bearer ${TOKEN}`, undefined)).toBe(false);
    expect(verifyUsageSyncToken(`Bearer ${TOKEN}`, "")).toBe(false);
  });

  it("ヘッダ欠落なら false", () => {
    expect(verifyUsageSyncToken(null, TOKEN)).toBe(false);
  });

  it("Bearer 形式でなければ false", () => {
    expect(verifyUsageSyncToken(TOKEN, TOKEN)).toBe(false);
    expect(verifyUsageSyncToken(`Basic ${TOKEN}`, TOKEN)).toBe(false);
  });

  it("トークン不一致（長さ違い・同じ長さの別値）なら false", () => {
    expect(verifyUsageSyncToken("Bearer short", TOKEN)).toBe(false);
    const sameLengthDifferent = TOKEN.replace(/.$/, "X");
    expect(verifyUsageSyncToken(`Bearer ${sameLengthDifferent}`, TOKEN)).toBe(false);
  });
});
