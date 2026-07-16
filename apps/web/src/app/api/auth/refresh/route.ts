import { parseAuthConfig } from "@/config/auth";
import {
  badRequest,
  forbidden,
  fromZodError,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api";
import { hasAllowedOrigin, hasValidCsrfToken, readCookie } from "@/lib/auth";
import { setWebSessionCookies } from "@/lib/web-auth";
import { refreshSessionSchema } from "@/schemas/auth";
import { AppleOutageError, RefreshSessionError, rotateAuthSession } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }
  const parsed = refreshSessionSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const config = parseAuthConfig();
    if (config.mode === "local") return unauthorized();

    const cookieToken = readCookie(req, config.refreshCookieName);
    const refreshToken = parsed.data.refreshToken ?? cookieToken;
    if (!refreshToken) return unauthorized();
    if (cookieToken && (!hasAllowedOrigin(req, config) || !hasValidCsrfToken(req, config))) {
      return forbidden();
    }

    const session = await rotateAuthSession(refreshToken, config);
    if (session.clientType === "web") {
      const response = ok({ refreshed: true, accessExpiresAt: session.accessExpiresAt });
      setWebSessionCookies(response, config, session, session.rememberBrowser);
      return response;
    }
    return ok({ session });
  } catch (error) {
    if (error instanceof AppleOutageError) return serviceUnavailable();
    if (error instanceof RefreshSessionError) return unauthorized();
    return serverError();
  }
}
