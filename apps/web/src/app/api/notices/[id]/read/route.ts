import { parseAuthConfig } from "@/config/auth";
import { forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { markNotificationNoticeRead } from "@/services/notifications";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();
    const { id } = await context.params;
    if (!(await markNotificationNoticeRead(auth.actor.userId, id))) return notFound();
    return ok({ read: true });
  } catch {
    return serverError();
  }
}
