import { ok, badRequest, fromZodError, serverError, unauthorized } from "@/lib/api";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/lib/apple-auth";
import { upsertAppleUser } from "@/services/auth";
import { appleCallbackSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }

  const parsed = appleCallbackSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      expectedNonce: parsed.data.nonce,
    });
    const actor = await upsertAppleUser(identity);
    return ok({ actor });
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
