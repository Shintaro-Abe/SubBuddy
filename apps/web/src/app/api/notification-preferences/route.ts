import { parseNotificationConfig } from "@/config/notifications";
import { badRequest, forbidden, fromZodError, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { notificationPreferencePatchSchema } from "@/schemas/notifications";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const config = parseNotificationConfig();
    return ok({
      enabled: config.enabled,
      preferences: await getNotificationPreferences(auth.actor.userId),
    });
  } catch {
    return serverError();
  }
}

export async function PATCH(req: Request) {
  try {
    const authConfig = parseNotificationConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (!authConfig.enabled) return forbidden();
    const config = (await import("@/config/auth")).parseAuthConfig();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }
    const parsed = notificationPreferencePatchSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    return ok(await updateNotificationPreferences(auth.actor.userId, parsed.data));
  } catch {
    return serverError();
  }
}
