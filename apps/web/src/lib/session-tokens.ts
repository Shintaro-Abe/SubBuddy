import { createHash, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { CloudAuthConfig } from "@/config/auth";

const ACCESS_TOKEN_ALGORITHM = "HS256";

export type AccessTokenClaims = {
  userId: string;
  sessionId: string;
  tokenId: string;
  issuedAt: Date;
  expiresAt: Date;
};

export class AccessTokenError extends Error {
  constructor() {
    super("invalid access token");
    this.name = "AccessTokenError";
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function issueAccessToken(
  userId: string,
  sessionId: string,
  config: CloudAuthConfig,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = new Date((issuedAt + config.accessTtlSeconds) * 1000);
  const token = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: "JWT" })
    .setIssuer(config.tokenIssuer)
    .setAudience(config.tokenAudience)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(config.jwtSecret);

  return { token, expiresAt };
}

export async function verifyAccessToken(
  token: string,
  config: CloudAuthConfig,
  now = new Date(),
): Promise<AccessTokenClaims> {
  try {
    const result = await jwtVerify(token, config.jwtSecret, {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      issuer: config.tokenIssuer,
      audience: config.tokenAudience,
      requiredClaims: ["sub", "sid", "jti", "iat", "exp"],
      currentDate: now,
    });
    const { sub, sid, jti, iat, exp } = result.payload;
    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      typeof jti !== "string" ||
      typeof iat !== "number" ||
      typeof exp !== "number"
    ) {
      throw new AccessTokenError();
    }
    return {
      userId: sub,
      sessionId: sid,
      tokenId: jti,
      issuedAt: new Date(iat * 1000),
      expiresAt: new Date(exp * 1000),
    };
  } catch {
    throw new AccessTokenError();
  }
}
