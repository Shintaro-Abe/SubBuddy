import { parseAuthConfig } from "@/config/auth";
import { created, badRequest, forbidden, fromZodError, serverError, unauthorized } from "@/lib/api";
import { authenticateRequest, authorizeStateChange } from "@/lib/auth";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "@/lib/apple-auth";
import {
  registerDeviceForAppleUser,
  registerDeviceForSession,
  upsertAppleUser,
} from "@/services/auth";
import { authenticatedDeviceRegistrationSchema, deviceRegistrationSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const config = parseAuthConfig();
    const auth =
      config.mode === "local"
        ? null
        : await authenticateRequest(req, undefined, undefined, (reason) => {
            console.warn("device_registration_rejected", { reason });
          });
    if (config.mode !== "local" && (!auth || !auth.sessionId)) return unauthorized();
    if (config.mode !== "local" && auth && !authorizeStateChange(req, auth, config)) {
      return forbidden();
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("request body must be valid JSON");
    }

    if (config.mode === "local") {
      const parsed = deviceRegistrationSchema.safeParse(body);
      if (!parsed.success) return fromZodError(parsed.error);
      const identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
        expectedNonce: parsed.data.nonce,
      });
      const actor = await upsertAppleUser(identity);
      const result = await registerDeviceForAppleUser(
        actor.userId,
        parsed.data.name,
        parsed.data.clientDeviceId,
      );
      return created(result);
    }

    const parsed = authenticatedDeviceRegistrationSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    if (!auth?.sessionId) return unauthorized();
    const result = await registerDeviceForSession(
      auth.actor.userId,
      auth.sessionId,
      parsed.data.name,
      parsed.data.clientDeviceId,
    );
    if (!result) {
      console.warn("device_registration_rejected", { reason: "session_attach_failed" });
      return unauthorized();
    }
    return created(result);
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) return unauthorized();
    return serverError();
  }
}
