import { parseAuthConfig } from "@/config/auth";
import { ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const config = parseAuthConfig();
    if (config.mode === "local") return ok({ mode: "local" as const });
    return ok({
      mode: config.mode,
      clientId: config.appleWebClientId,
      redirectUri: config.appleRedirectUri,
    });
  } catch {
    return serverError();
  }
}
