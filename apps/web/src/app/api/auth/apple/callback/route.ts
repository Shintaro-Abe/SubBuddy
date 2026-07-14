import { parseAuthConfig } from "@/config/auth";
import {
  ok,
  badRequest,
  conflict,
  forbidden,
  fromZodError,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api";
import { hasAllowedOrigin, readCookie } from "@/lib/auth";
import {
  AppleIdentityTokenError,
  hashAppleNonce,
  verifyAppleIdentityToken,
} from "@/lib/apple-auth";
import {
  AppleOutageError,
  exchangeAppleIdentityForSession,
  SessionLimitError,
  upsertAppleUser,
} from "@/services/auth";
import { appleCallbackSchema } from "@/schemas/auth";
import { authFlowCookieNames, clearAuthFlowCookies, setWebSessionCookies } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }

  const parsed = appleCallbackSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const config = parseAuthConfig();
    if (config.mode === "local") {
      const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
        expectedNonce: parsed.data.nonce ? hashAppleNonce(parsed.data.nonce) : undefined,
      });
      const actor = await upsertAppleUser(identity);
      return ok({ actor, redirectTo: "/" });
    }

    if (!hasAllowedOrigin(req, config)) return forbidden();
    if (config.appleOutageStartedAt) return serviceUnavailable();
    const names = authFlowCookieNames(config);
    const state = readCookie(req, names.state);
    const nonce = readCookie(req, names.nonce);
    const remember = readCookie(req, names.remember);
    if (
      !state ||
      !nonce ||
      parsed.data.state !== state ||
      parsed.data.nonce !== nonce ||
      (remember !== "0" && remember !== "1")
    ) {
      return forbidden();
    }

    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      allowedClientIds: config.appleAllowedClientIds,
      expectedNonce: hashAppleNonce(nonce),
      subjectHashSalt: config.appleSubjectHashSalt,
    });
    const result = await exchangeAppleIdentityForSession(
      identity,
      { clientType: "web", rememberBrowser: remember === "1" },
      config,
    );
    const response = ok({ actor: result.actor, redirectTo: "/" });
    setWebSessionCookies(response, config, result.session, remember === "1");
    clearAuthFlowCookies(response, config);
    return response;
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    if (error instanceof AppleOutageError) return serviceUnavailable();
    if (error instanceof SessionLimitError) return conflict("session limit reached");
    return serverError();
  }
}
