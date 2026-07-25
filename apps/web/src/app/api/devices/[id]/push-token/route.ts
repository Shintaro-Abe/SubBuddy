import { parseAuthConfig } from "@/config/auth";
import {
  badRequest,
  forbidden,
  fromZodError,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { pushTokenSchema } from "@/schemas/notifications";
import {
  clearPushToken,
  PushEnvironmentMismatchError,
  registerPushToken,
} from "@/services/notifications";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode === "local" || !authorizeStateChange(req, auth, config)) return forbidden();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }
    const parsed = pushTokenSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { id } = await context.params;
    const saved = await registerPushToken(
      auth.actor.userId,
      id,
      parsed.data.token,
      parsed.data.environment,
      parsed.data.deliveryEnabled,
      parsed.data.timeZone,
    );
    if (!saved) return notFound();
    return ok({ registered: true });
  } catch (error) {
    if (error instanceof PushEnvironmentMismatchError) {
      return badRequest("push environment does not match server");
    }
    return serverError();
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode === "local" || !authorizeStateChange(req, auth, config)) return forbidden();
    const { id } = await context.params;
    if (!(await clearPushToken(auth.actor.userId, id))) return notFound();
    return ok({ removed: true });
  } catch {
    return serverError();
  }
}
