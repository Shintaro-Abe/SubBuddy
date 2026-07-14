import { parseAuthConfig } from "@/config/auth";
import { badRequest, forbidden, fromZodError, ok, serverError } from "@/lib/api";
import { hasAllowedOrigin } from "@/lib/auth";
import { generateBrowserSecret, setAuthFlowCookies } from "@/lib/web-auth";
import { appleWebStartSchema } from "@/schemas/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("request body must be valid JSON");
  }
  const parsed = appleWebStartSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const config = parseAuthConfig();
    if (config.mode === "local") return ok({ local: true, redirectTo: "/" });
    if (!hasAllowedOrigin(req, config)) return forbidden();

    const state = generateBrowserSecret();
    const nonce = generateBrowserSecret();
    const response = ok({ state, nonce, redirectTo: "/" });
    setAuthFlowCookies(response, config, state, nonce, parsed.data.rememberBrowser);
    return response;
  } catch {
    return serverError();
  }
}
