import { parseAuthConfig } from "@/config/auth";
import {
  AppleIdentityTokenError,
  hashAppleNonce,
  verifyAppleIdentityToken,
} from "@/lib/apple-auth";
import { badRequest, forbidden, fromZodError, ok, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { clearWebSessionCookies } from "@/lib/web-auth";
import { accountDeletionSchema } from "@/schemas/auth";
import {
  appleIdentityBelongsToUser,
  listActiveSessions,
  revokeAllSessionsAndDevices,
} from "@/services/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    const items = await listActiveSessions(auth.actor.userId, auth.sessionId);
    return ok({ items });
  } catch {
    return serverError();
  }
}

export async function DELETE(req: Request) {
  try {
    const config = parseAuthConfig();
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorized();
    if (config.mode === "local") return ok({ signedOutAll: true });
    if (!authorizeStateChange(req, auth, config)) return forbidden();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }
    const parsed = accountDeletionSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    if (!parsed.data.nonce) return unauthorized();

    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      allowedClientIds: config.appleAllowedClientIds,
      expectedNonce: hashAppleNonce(parsed.data.nonce),
      subjectHashSalt: config.appleSubjectHashSalt,
    });
    if (!(await appleIdentityBelongsToUser(identity, auth.actor.userId))) return unauthorized();

    await revokeAllSessionsAndDevices(auth.actor.userId, "signed_out_all");
    const response = ok({ signedOutAll: true });
    if (auth.transport === "cookie") clearWebSessionCookies(response, config);
    return response;
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
