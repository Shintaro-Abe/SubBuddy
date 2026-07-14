import { parseAuthConfig } from "@/config/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { clearWebSessionCookies } from "@/lib/web-auth";
import { revokeSession } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode === "local") return ok({ signedOut: true });
    if (!authorizeStateChange(req, auth, config)) return forbidden();
    if (!auth.sessionId) return unauthorized();

    await revokeSession(auth.actor.userId, auth.sessionId, "signed_out");
    const response = ok({ signedOut: true });
    if (auth.transport === "cookie") clearWebSessionCookies(response, config);
    return response;
  } catch {
    return serverError();
  }
}
