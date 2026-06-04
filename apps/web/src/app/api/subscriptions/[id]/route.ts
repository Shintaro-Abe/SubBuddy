import { getCurrentUserId } from "@/lib/user";
import { ok, fromZodError, badRequest, notFound, serverError } from "@/lib/api";
import { subscriptionUpdateSchema } from "@/schemas/subscription";
import {
  deleteSubscription,
  getSubscription,
  updateSubscription,
} from "@/repositories/subscriptions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const sub = await getSubscription(getCurrentUserId(), id);
    return sub ? ok(sub) : notFound();
  } catch {
    return serverError();
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }
  const parsed = subscriptionUpdateSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const updated = await updateSubscription(getCurrentUserId(), id, parsed.data);
    return updated ? ok(updated) : notFound();
  } catch {
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const removed = await deleteSubscription(getCurrentUserId(), id);
    return removed ? ok({ deleted: true }) : notFound();
  } catch {
    return serverError();
  }
}
