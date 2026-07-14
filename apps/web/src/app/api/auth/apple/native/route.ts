import {
  ok,
  badRequest,
  conflict,
  fromZodError,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api";
import {
  AppleIdentityTokenError,
  hashAppleNonce,
  verifyAppleIdentityToken,
} from "@/lib/apple-auth";
import { parseAuthConfig } from "@/config/auth";
import {
  AppleOutageError,
  exchangeAppleIdentityForSession,
  SessionLimitError,
  upsertAppleUser,
} from "@/services/auth";
import { appleNativeSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

/**
 * iOS ネイティブ Sign in with Apple 用エンドポイント（ADR 0004）。
 * Web の OAuth callback と入口を分け、identity token の aud は許可リストで検証する。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }

  const parsed = appleNativeSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const config = parseAuthConfig();
    if (config.mode !== "local" && config.appleOutageStartedAt) return serviceUnavailable();
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      allowedClientIds: config.mode === "local" ? undefined : config.appleAllowedClientIds,
      expectedNonce: hashAppleNonce(parsed.data.nonce),
      subjectHashSalt: config.mode === "local" ? undefined : config.appleSubjectHashSalt,
    });

    if (config.mode !== "local") {
      const result = await exchangeAppleIdentityForSession(identity, { clientType: "ios" }, config);
      return ok(result);
    }

    const actor = await upsertAppleUser(identity);
    return ok({ actor });
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    if (error instanceof AppleOutageError) return serviceUnavailable();
    if (error instanceof SessionLimitError) return conflict("session limit reached");
    return serverError();
  }
}
