import { createHash, createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const DEFAULT_CLOCK_SKEW_SECONDS = 300;

type AppleJwtHeader = {
  alg?: string;
  kid?: string;
};

type AppleJwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  nonce?: string;
};

type AppleJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
};

type AppleJwks = {
  keys?: AppleJwk[];
};

export type AppleIdentity = {
  subject: string;
  subjectHash: string;
  email?: string;
};

export class AppleIdentityTokenError extends Error {
  constructor(message = "invalid apple identity token") {
    super(message);
    this.name = "AppleIdentityTokenError";
  }
}

export type VerifyAppleIdentityTokenOptions = {
  /**
   * 後方互換用の単一 client id。新規コードでは allowedClientIds を優先する。
   */
  clientId?: string;
  /**
   * Apple identity token の aud 許可リスト。
   * Web Services ID と iOS Bundle ID の両方を許可する（ADR 0004）。
   */
  allowedClientIds?: string[];
  expectedNonce?: string;
  subjectHashSalt?: string;
  now?: Date;
  jwksUrl?: string;
  fetchImpl?: typeof fetch;
};

function decodeBase64Url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function decodeJsonPart<T>(input: string): T {
  try {
    return JSON.parse(decodeBase64Url(input).toString("utf8")) as T;
  } catch {
    throw new AppleIdentityTokenError();
  }
}

function hasAudience(audience: string | string[] | undefined, clientId: string) {
  if (Array.isArray(audience)) return audience.includes(clientId);
  return audience === clientId;
}

function parseAllowedClientIdsFromEnv(): string[] {
  const raw = process.env.APPLE_ALLOWED_CLIENT_IDS;
  if (raw) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return process.env.APPLE_CLIENT_ID ? [process.env.APPLE_CLIENT_ID] : [];
}

function resolveAllowedClientIds(options: VerifyAppleIdentityTokenOptions): string[] {
  const explicit = options.allowedClientIds ?? (options.clientId ? [options.clientId] : undefined);
  const ids = explicit ?? parseAllowedClientIdsFromEnv();
  return [...new Set(ids.filter(Boolean))];
}

function hasAllowedAudience(audience: string | string[] | undefined, allowedClientIds: string[]) {
  return allowedClientIds.some((clientId) => hasAudience(audience, clientId));
}

async function fetchAppleJwk(
  kid: string,
  jwksUrl: string,
  fetchImpl: typeof fetch,
): Promise<AppleJwk> {
  const res = await fetchImpl(jwksUrl, { cache: "no-store" });
  if (!res.ok) throw new AppleIdentityTokenError();

  const jwks = (await res.json()) as AppleJwks;
  const jwk = jwks.keys?.find((key) => key.kid === kid);
  if (!jwk) throw new AppleIdentityTokenError();
  return jwk;
}

function verifyRs256Signature(jwk: AppleJwk, signingInput: string, signature: Buffer) {
  try {
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signingInput);
    verifier.end();
    return verifier.verify(publicKey, signature);
  } catch {
    return false;
  }
}

export function hashAppleSubject(
  subject: string,
  salt = process.env.APPLE_SUBJECT_HASH_SALT ?? "",
): string {
  return createHash("sha256").update(`apple:${salt}:${subject}`, "utf8").digest("hex");
}

export function hashAppleNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  options: VerifyAppleIdentityTokenOptions = {},
): Promise<AppleIdentity> {
  const allowedClientIds = resolveAllowedClientIds(options);
  if (allowedClientIds.length === 0) throw new AppleIdentityTokenError();

  const parts = identityToken.split(".");
  if (parts.length !== 3) throw new AppleIdentityTokenError();

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart<AppleJwtHeader>(encodedHeader);
  const payload = decodeJsonPart<AppleJwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) throw new AppleIdentityTokenError();

  const jwk = await fetchAppleJwk(
    header.kid,
    options.jwksUrl ?? APPLE_JWKS_URL,
    options.fetchImpl ?? fetch,
  );
  const signatureValid = verifyRs256Signature(
    jwk,
    `${encodedHeader}.${encodedPayload}`,
    decodeBase64Url(encodedSignature),
  );
  if (!signatureValid) throw new AppleIdentityTokenError();

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (payload.iss !== APPLE_ISSUER) throw new AppleIdentityTokenError();
  if (!hasAllowedAudience(payload.aud, allowedClientIds)) throw new AppleIdentityTokenError();
  if (!payload.exp || payload.exp <= nowSeconds - DEFAULT_CLOCK_SKEW_SECONDS) {
    throw new AppleIdentityTokenError();
  }
  if (payload.iat && payload.iat > nowSeconds + DEFAULT_CLOCK_SKEW_SECONDS) {
    throw new AppleIdentityTokenError();
  }
  if (!payload.sub) throw new AppleIdentityTokenError();
  if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
    throw new AppleIdentityTokenError();
  }

  return {
    subject: payload.sub,
    subjectHash: hashAppleSubject(payload.sub, options.subjectHashSalt),
    email: payload.email,
  };
}
