import { z } from "zod";

const CLOUD_MODES = ["cloud-testflight", "production"] as const;
const ACCESS_TTL_SECONDS = 15 * 60;
const WEB_SESSION_TTL_SECONDS = 24 * 60 * 60;
const IDLE_TTL_SECONDS = 30 * 24 * 60 * 60;
const ABSOLUTE_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_APPLE_OUTAGE_GRACE_SECONDS = 72 * 60 * 60;
type Environment = Record<string, string | undefined>;

const modeSchema = z.enum(["local", ...CLOUD_MODES]);

const cloudEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APPLE_ALLOWED_CLIENT_IDS: z.string().min(1),
  APPLE_SUBJECT_HASH_SALT: z.string().min(32),
  AUTH_TOKEN_ISSUER: z.string().url(),
  AUTH_TOKEN_AUDIENCE: z.string().min(1),
  AUTH_JWT_SECRET_BASE64URL: z.string().min(43),
  AUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_WEB_SESSION_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_IDLE_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_APPLE_OUTAGE_GRACE_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_APPLE_OUTAGE_GRACE_SECONDS),
  AUTH_ACCESS_COOKIE_NAME: z.string().min(1),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(1),
  AUTH_CSRF_COOKIE_NAME: z.string().min(1),
  AUTH_ALLOWED_ORIGINS: z.string().min(1),
});

export type CloudMode = (typeof CLOUD_MODES)[number];

export type LocalAuthConfig = {
  mode: "local";
};

export type CloudAuthConfig = {
  mode: CloudMode;
  databaseUrl: string;
  appleAllowedClientIds: string[];
  appleSubjectHashSalt: string;
  tokenIssuer: string;
  tokenAudience: string;
  jwtSecret: Uint8Array;
  accessTtlSeconds: number;
  webSessionTtlSeconds: number;
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
  appleOutageGraceSeconds: number;
  accessCookieName: string;
  refreshCookieName: string;
  csrfCookieName: string;
  allowedOrigins: string[];
};

export type AuthConfig = LocalAuthConfig | CloudAuthConfig;

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

function parseCommaSeparated(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parseOrigins(value: string): string[] {
  const origins = parseCommaSeparated(value).map((item) => {
    try {
      const url = new URL(item);
      if (url.protocol !== "https:" || url.origin !== item.replace(/\/$/, "")) {
        throw new Error();
      }
      return url.origin;
    } catch {
      throw new AuthConfigError("AUTH_ALLOWED_ORIGINS must contain HTTPS origins only");
    }
  });
  if (origins.length === 0) throw new AuthConfigError("AUTH_ALLOWED_ORIGINS is required");
  return origins;
}

function parseJwtSecret(value: string): Uint8Array {
  try {
    const secret = Buffer.from(value, "base64url");
    if (secret.length < 32 || secret.toString("base64url") !== value) throw new Error();
    return secret;
  } catch {
    throw new AuthConfigError("AUTH_JWT_SECRET_BASE64URL must be at least 256 bits");
  }
}

function assertApprovedDurations(values: z.infer<typeof cloudEnvironmentSchema>) {
  const expected = {
    AUTH_ACCESS_TTL_SECONDS: ACCESS_TTL_SECONDS,
    AUTH_WEB_SESSION_TTL_SECONDS: WEB_SESSION_TTL_SECONDS,
    AUTH_IDLE_TTL_SECONDS: IDLE_TTL_SECONDS,
    AUTH_ABSOLUTE_TTL_SECONDS: ABSOLUTE_TTL_SECONDS,
  } as const;

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (values[key as keyof typeof expected] !== expectedValue) {
      throw new AuthConfigError(`${key} must match the approved authentication policy`);
    }
  }
}

function assertCookieNames(mode: CloudMode, names: string[]) {
  if (new Set(names).size !== names.length) {
    throw new AuthConfigError("authentication cookie names must be unique");
  }
  const prefix = mode === "production" ? "__Host-subbuddy-" : "__Host-subbuddy-testflight-";
  if (names.some((name) => !name.startsWith(prefix))) {
    throw new AuthConfigError(`authentication cookie names must start with ${prefix}`);
  }
}

export function parseAuthConfig(env: Environment = process.env): AuthConfig {
  const parsedMode = modeSchema.safeParse(env.SUBBUDDY_MODE);
  if (!parsedMode.success) {
    throw new AuthConfigError("SUBBUDDY_MODE must be local, cloud-testflight, or production");
  }
  if (parsedMode.data === "local") return { mode: "local" };

  const parsed = cloudEnvironmentSchema.safeParse(env);
  if (!parsed.success) {
    const missingOrInvalid = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new AuthConfigError(
      `invalid cloud authentication configuration: ${missingOrInvalid.join(", ")}`,
    );
  }

  const values = parsed.data;
  assertApprovedDurations(values);
  const appleAllowedClientIds = parseCommaSeparated(values.APPLE_ALLOWED_CLIENT_IDS);
  if (appleAllowedClientIds.length < 2) {
    throw new AuthConfigError("APPLE_ALLOWED_CLIENT_IDS must contain Web and iOS identifiers");
  }
  const cookieNames = [
    values.AUTH_ACCESS_COOKIE_NAME,
    values.AUTH_REFRESH_COOKIE_NAME,
    values.AUTH_CSRF_COOKIE_NAME,
  ];
  assertCookieNames(parsedMode.data, cookieNames);

  return {
    mode: parsedMode.data,
    databaseUrl: values.DATABASE_URL,
    appleAllowedClientIds,
    appleSubjectHashSalt: values.APPLE_SUBJECT_HASH_SALT,
    tokenIssuer: values.AUTH_TOKEN_ISSUER,
    tokenAudience: values.AUTH_TOKEN_AUDIENCE,
    jwtSecret: parseJwtSecret(values.AUTH_JWT_SECRET_BASE64URL),
    accessTtlSeconds: values.AUTH_ACCESS_TTL_SECONDS,
    webSessionTtlSeconds: values.AUTH_WEB_SESSION_TTL_SECONDS,
    idleTtlSeconds: values.AUTH_IDLE_TTL_SECONDS,
    absoluteTtlSeconds: values.AUTH_ABSOLUTE_TTL_SECONDS,
    appleOutageGraceSeconds: values.AUTH_APPLE_OUTAGE_GRACE_SECONDS,
    accessCookieName: values.AUTH_ACCESS_COOKIE_NAME,
    refreshCookieName: values.AUTH_REFRESH_COOKIE_NAME,
    csrfCookieName: values.AUTH_CSRF_COOKIE_NAME,
    allowedOrigins: parseOrigins(values.AUTH_ALLOWED_ORIGINS),
  };
}

export function validateRuntimeConfiguration(env: Environment = process.env): void {
  parseAuthConfig(env);
}
