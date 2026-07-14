import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";

/**
 * 利用量同期 API のトークン検証（architecture §8.1.1）。
 * 認証で弾かれるケースは DB に触れる前に 401 を返すため、実 DB なしで検証できる。
 */

const TOKEN = "synthetic-test-token-for-unit-tests";

function makeRequest(headers: Record<string, string> = {}, body = "{}") {
  return new Request("http://localhost/api/usage/daily", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/usage/daily の認証", () => {
  beforeEach(() => {
    vi.stubEnv("SUBBUDDY_MODE", "local");
    vi.stubEnv("USAGE_SYNC_TOKEN", TOKEN);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Authorization ヘッダなしは 401", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("トークン不一致は 401", async () => {
    const res = await POST(makeRequest({ authorization: "Bearer wrong-token" }));
    expect(res.status).toBe(401);
  });

  it("USAGE_SYNC_TOKEN 未設定なら正しい形式のヘッダでも 401（フェイルクローズ）", async () => {
    vi.stubEnv("USAGE_SYNC_TOKEN", "");
    const res = await POST(makeRequest({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(401);
  });

  it("正しいトークンなら認証を通過する（不正ボディは 400 になる）", async () => {
    const res = await POST(makeRequest({ authorization: `Bearer ${TOKEN}` }, "{not json"));
    expect(res.status).toBe(400);
  });

  it("認証設定の例外は統一された500応答になる", async () => {
    vi.stubEnv("SUBBUDDY_MODE", "invalid-mode");
    const res = await POST(makeRequest({ authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal server error" });
  });
});
