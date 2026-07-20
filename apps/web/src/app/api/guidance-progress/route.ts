import { parseAuthConfig } from "@/config/auth";
import { badRequest, forbidden, fromZodError, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { guidanceEventSchema } from "@/schemas/guidance-progress";
import { getResolvedGuidanceProgress, recordGuidanceEvent } from "@/services/guidance-progress";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    return ok(await getResolvedGuidanceProgress(auth.actor.userId));
  } catch {
    return serverError();
  }
}

export async function PATCH(req: Request) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }
    const parsed = guidanceEventSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    return ok(await recordGuidanceEvent(auth.actor.userId, parsed.data.event));
  } catch {
    return serverError();
  }
}
