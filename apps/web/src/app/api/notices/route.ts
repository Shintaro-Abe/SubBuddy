import { ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest } from "@/lib/auth";
import { listNotificationNotices } from "@/services/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    return ok({ items: await listNotificationNotices(auth.actor.userId) });
  } catch {
    return serverError();
  }
}
