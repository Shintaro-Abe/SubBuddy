import { parseAuthConfig } from "@/config/auth";
import {
  ok,
  badRequest,
  forbidden,
  fromZodError,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/lib/apple-auth";
import {
  revokeDeviceAndSessions,
  revokeDeviceForAppleUser,
  upsertAppleUser,
} from "@/services/auth";
import { deviceRevocationSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;

  try {
    const config = parseAuthConfig();
    if (config.mode !== "local") {
      const auth = await authenticateRequest(req);
      if (!auth) return unauthorized();
      if (!authorizeStateChange(req, auth, config)) return forbidden();
      const revoked = await revokeDeviceAndSessions(auth.actor.userId, id);
      if (!revoked) return notFound();
      return ok({ revoked: true });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }
    const parsed = deviceRevocationSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

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
