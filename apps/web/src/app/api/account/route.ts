import { ok, badRequest, fromZodError, serverError, unauthorized } from "@/lib/api";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/lib/apple-auth";
import { deleteAppleUserAccount } from "@/services/auth";
import { accountDeletionSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

/**
 * アカウント削除（App Store 5.1.1(v) 対応）。
 * Apple identity token で本人確認し、users を物理削除する。関連データは DB cascade で削除する。
 */
export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }

  const parsed = accountDeletionSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      expectedNonce: parsed.data.nonce,
    });
    const deleted = await deleteAppleUserAccount(identity);
    return ok({ deleted });
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
