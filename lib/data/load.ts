import "server-only";
import { unstable_rethrow } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { logServerError, toUserMessage } from "@/lib/db/errors";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Authorizes the request, then runs the data loader. Failures become a safe
 * message so pages can render an error state instead of crashing.
 */
export async function load<T>(context: string, fn: () => Promise<T>): Promise<Loaded<T>> {
  await requireAuth();
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    logServerError(context, error);
    return { ok: false, error: toUserMessage(error) };
  }
}
