import { getCurrentUserId } from "@/lib/user";
import { ok, created, fromZodError, badRequest, serverError } from "@/lib/api";
import { subscriptionCreateSchema } from "@/schemas/subscription";
import { createSubscription, listSubscriptions } from "@/repositories/subscriptions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const subs = await listSubscriptions(getCurrentUserId());
    return ok({ items: subs });
  } catch {
    return serverError();
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }
  const parsed = subscriptionCreateSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const sub = await createSubscription(getCurrentUserId(), parsed.data);
    return created(sub);
  } catch {
    return serverError();
  }
}
