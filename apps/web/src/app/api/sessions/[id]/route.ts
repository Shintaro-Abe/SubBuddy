import { parseAuthConfig } from "@/config/auth";
import { forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { clearWebSessionCookies } from "@/lib/web-auth";
import { revokeSession } from "@/services/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();

    const { id } = await params;
    const revoked = await revokeSession(auth.actor.userId, id, "revoked_by_user");
    if (!revoked) return notFound();
    const response = ok({ revoked: true });
    if (config.mode !== "local" && auth.transport === "cookie" && id === auth.sessionId) {
      clearWebSessionCookies(response, config);
    }
    return response;
  } catch {
    return serverError();
  }
}
