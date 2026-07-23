import { parseAuthConfig } from "@/config/auth";
import {
  ok,
  created,
  fromZodError,
  badRequest,
  forbidden,
  serverError,
  unauthorized,
} from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { subscriptionCreateSchema } from "@/schemas/subscription";
import { createSubscription, listSubscriptions } from "@/repositories/subscriptions";
import { refreshRecommendationAfterMutation } from "@/services/recompute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const subs = await listSubscriptions(auth.actor.userId);
    return ok({ items: subs });
  } catch {
    return serverError();
  }
}

export async function POST(req: Request) {
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
    const parsed = subscriptionCreateSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const sub = await createSubscription(auth.actor.userId, parsed.data);
    await refreshRecommendationAfterMutation(auth.actor.userId, sub.id);
    return created(sub);
  } catch {
    return serverError();
  }
}
