import { createSign, generateKeyPairSync, type JsonWebKey } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppleIdentityTokenError,
  hashAppleSubject,
  verifyAppleIdentityToken,
} from "@/lib/apple-auth";

const CLIENT_ID = "com.example.subbuddy.test";
const KID = "apple-key-1";
const NOW = new Date("2026-07-02T09:00:00.000Z");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...(publicKey.export({ format: "jwk" }) as JsonWebKey),
  kid: KID,
  alg: "RS256",
  use: "sig",
};

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signAppleToken(payloadOverrides: Record<string, unknown> = {}) {
  const nowSeconds = Math.floor(NOW.getTime() / 1000);
  const header = encodeJson({ alg: "RS256", kid: KID });
  const payload = encodeJson({
    iss: "https://appleid.apple.com",
    aud: CLIENT_ID,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
    sub: "apple-user-alpha",
    email: "relay_example_invalid",
    nonce: "nonce-1",
    ...payloadOverrides,
  });
  const signingInput = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function fetchJwks(): Promise<Response> {
  return Promise.resolve(Response.json({ keys: [publicJwk] }));
}

describe("verifyAppleIdentityToken", () => {
  beforeEach(() => {
    vi.stubEnv("APPLE_SUBJECT_HASH_SALT", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Apple identity token を検証して stable identifier のハッシュを返す", async () => {
    const identity = await verifyAppleIdentityToken(signAppleToken(), {
      clientId: CLIENT_ID,
      expectedNonce: "nonce-1",
      now: NOW,
      fetchImpl: fetchJwks,
    });

    expect(identity).toEqual({
      subject: "apple-user-alpha",
      subjectHash: hashAppleSubject("apple-user-alpha"),
      email: "relay_example_invalid",
    });
  });

  it("audience が異なる token は拒否する", async () => {
    await expect(
      verifyAppleIdentityToken(signAppleToken({ aud: "wrong-client" }), {
        clientId: CLIENT_ID,
        now: NOW,
        fetchImpl: fetchJwks,
      }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  it("nonce が異なる token は拒否する", async () => {
    await expect(
      verifyAppleIdentityToken(signAppleToken(), {
        clientId: CLIENT_ID,
        expectedNonce: "other-nonce",
        now: NOW,
        fetchImpl: fetchJwks,
      }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  it("署名が壊れた token は拒否する", async () => {
    const token = signAppleToken();
    const tampered = token.replace(/.$/, token.endsWith("a") ? "b" : "a");

    await expect(
      verifyAppleIdentityToken(tampered, {
        clientId: CLIENT_ID,
        now: NOW,
        fetchImpl: fetchJwks,
      }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });
});
