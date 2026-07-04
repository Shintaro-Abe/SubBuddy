import { ok, badRequest, fromZodError, notFound, serverError, unauthorized } from "@/lib/api";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/lib/apple-auth";
import { revokeDeviceForAppleUser, upsertAppleUser } from "@/services/auth";
import { deviceRevocationSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }

  const parsed = deviceRevocationSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      expectedNonce: parsed.data.nonce,
    });
    const actor = await upsertAppleUser(identity);
    const revoked = await revokeDeviceForAppleUser(actor.userId, id);
    if (!revoked) return notFound();
    return ok({ revoked: true });
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
