import { parseAuthConfig } from "@/config/auth";
import {
  ok,
  fromZodError,
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { subscriptionUpdateSchema } from "@/schemas/subscription";
import {
  deleteSubscription,
  getSubscription,
  updateSubscription,
} from "@/repositories/subscriptions";
import { refreshRecommendationAfterMutation } from "@/services/recompute";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const sub = await getSubscription(auth.actor.userId, id);
    return sub ? ok(sub) : notFound();
  } catch {
    return serverError();
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
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
    const parsed = subscriptionUpdateSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const updated = await updateSubscription(auth.actor.userId, id, parsed.data);
    if (updated) await refreshRecommendationAfterMutation(auth.actor.userId, id);
    return updated ? ok(updated) : notFound();
  } catch {
    return serverError();
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode !== "local" && !authorizeStateChange(req, auth, config)) return forbidden();
    const removed = await deleteSubscription(auth.actor.userId, id);
    return removed ? ok({ deleted: true }) : notFound();
  } catch {
    return serverError();
  }
}
