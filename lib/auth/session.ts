import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, authMode, verifySessionToken } from "./token";

/** True when the current request carries a valid session (or auth is disabled in dev). */
export async function isAuthenticated(): Promise<boolean> {
  const mode = authMode();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (mode.mode === "disabled-dev") return true;
  if (mode.mode === "misconfigured") return false;
  return verifySessionToken(token, mode.secret);
}

/**
 * Data-access guard: every page, Server Action and Route Handler that touches
 * private data calls this on the server. Hiding UI is never relied upon.
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}
