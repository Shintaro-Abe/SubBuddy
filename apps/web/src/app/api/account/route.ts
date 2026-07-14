import { parseAuthConfig } from "@/config/auth";
import { ok, badRequest, forbidden, fromZodError, serverError, unauthorized } from "@/lib/api";
import {
  AppleIdentityTokenError,
  hashAppleNonce,
  verifyAppleIdentityToken,
} from "@/lib/apple-auth";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { clearWebSessionCookies } from "@/lib/web-auth";
import { appleIdentityBelongsToUser, deleteAppleUserAccount } from "@/services/auth";
import { accountDeletionSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

/**
 * アカウント削除（App Store 5.1.1(v) 対応）。
 * Apple identity token で本人確認し、users を物理削除する。関連データは DB cascade で削除する。
 */
export async function DELETE(req: Request) {
  try {
    const config = parseAuthConfig();
    let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
    if (config.mode !== "local") {
      auth = await authenticateRequest(req);
      if (!auth) return unauthorized();
      if (!authorizeStateChange(req, auth, config)) return forbidden();
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }
    const parsed = accountDeletionSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    if (config.mode !== "local" && auth) {
      if (!parsed.data.nonce) return unauthorized();
      const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
        allowedClientIds: config.appleAllowedClientIds,
        expectedNonce: hashAppleNonce(parsed.data.nonce),
        subjectHashSalt: config.appleSubjectHashSalt,
      });
      if (!(await appleIdentityBelongsToUser(identity, auth.actor.userId))) return unauthorized();
      const deleted = await deleteAppleUserAccount(identity);
      const response = ok({ deleted });
      if (auth.transport === "cookie") clearWebSessionCookies(response, config);
      return response;
    }

    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      expectedNonce: parsed.data.nonce ? hashAppleNonce(parsed.data.nonce) : undefined,
    });
    const deleted = await deleteAppleUserAccount(identity);
    return ok({ deleted });
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
