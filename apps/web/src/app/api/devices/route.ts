import { created, badRequest, fromZodError, serverError, unauthorized } from "@/lib/api";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/lib/apple-auth";
import { registerDeviceForAppleUser, upsertAppleUser } from "@/services/auth";
import { deviceRegistrationSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }

  const parsed = deviceRegistrationSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      expectedNonce: parsed.data.nonce,
    });
    const actor = await upsertAppleUser(identity);
    const result = await registerDeviceForAppleUser(actor.userId, parsed.data.name);
    return created(result);
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
