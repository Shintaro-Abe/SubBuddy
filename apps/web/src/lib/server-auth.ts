import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateRequest } from "@/lib/auth";

export async function requireServerUserId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const auth = await authenticateRequest(
    new Request("http://subbuddy.internal/", { headers: { cookie: cookieHeader } }),
  );
  if (!auth) redirect("/sign-in");
  return auth.actor.userId;
}
