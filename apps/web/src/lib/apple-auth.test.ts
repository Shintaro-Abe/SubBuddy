import { createSign, generateKeyPairSync, type JsonWebKey } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppleIdentityTokenError,
  hashAppleNonce,
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
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(privateKey)
    .toString("base64url");
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
    ).rejects.toMatchObject({
      name: "AppleIdentityTokenError",
      reason: "audience_mismatch",
    });
  });

  it("aud 許可リスト内なら Web / iOS の複数 aud を受け入れる（ADR 0004）", async () => {
    const allowedClientIds = ["com.subbuddy.web", "com.subbuddy.app"];

    const web = await verifyAppleIdentityToken(signAppleToken({ aud: "com.subbuddy.web" }), {
      allowedClientIds,
      expectedNonce: "nonce-1",
      now: NOW,
      fetchImpl: fetchJwks,
    });
    expect(web.subject).toBe("apple-user-alpha");

    const ios = await verifyAppleIdentityToken(signAppleToken({ aud: "com.subbuddy.app" }), {
      allowedClientIds,
      expectedNonce: "nonce-1",
      now: NOW,
      fetchImpl: fetchJwks,
    });
    expect(ios.subject).toBe("apple-user-alpha");
    expect(ios.subjectHash).toBe(web.subjectHash);
  });

  it("native nonce はクライアントの生値をSHA-256にしたclaimと照合できる", async () => {
    const rawNonce = "synthetic-native-nonce-with-enough-entropy";
    const identity = await verifyAppleIdentityToken(
      signAppleToken({ nonce: hashAppleNonce(rawNonce) }),
      {
        clientId: CLIENT_ID,
        expectedNonce: hashAppleNonce(rawNonce),
        now: NOW,
        fetchImpl: fetchJwks,
      },
    );

    expect(identity.subjectHash).toBe(hashAppleSubject("apple-user-alpha"));
  });

  it("明示した環境別saltでApple subjectをハッシュする", async () => {
    const identity = await verifyAppleIdentityToken(signAppleToken(), {
      clientId: CLIENT_ID,
      subjectHashSalt: "synthetic-testflight-salt",
      now: NOW,
      fetchImpl: fetchJwks,
    });

    expect(identity.subjectHash).toBe(
      hashAppleSubject("apple-user-alpha", "synthetic-testflight-salt"),
    );
  });

  it("許可リストにない aud は拒否する（ADR 0004）", async () => {
    await expect(
      verifyAppleIdentityToken(signAppleToken({ aud: "com.subbuddy.evil" }), {
        allowedClientIds: ["com.subbuddy.web", "com.subbuddy.app"],
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
    ).rejects.toMatchObject({
      name: "AppleIdentityTokenError",
      reason: "nonce_mismatch",
    });
  });

  it("署名が壊れた token は拒否する", async () => {
    const parts = signAppleToken().split(".");
    const signature = parts[2]!;
    const tamperedSignature = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
    const tampered = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

    await expect(
      verifyAppleIdentityToken(tampered, {
        clientId: CLIENT_ID,
        now: NOW,
        fetchImpl: fetchJwks,
      }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });
});
