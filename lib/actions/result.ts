import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { logServerError, toUserMessage, UserFacingError } from "@/lib/db/errors";
import { SessionNumberError } from "@/lib/db/repositories/sessions";
import { fieldErrors } from "@/lib/validation/schemas";
import type { ActionResult } from "./types";

/**
 * Wraps every Server Action: authorization on the server, validation errors
 * mapped to fields, database errors mapped to safe messages, and all views
 * revalidated after a successful mutation.
 */
export async function runAction<T = undefined>(
  context: string,
  fn: () => Promise<{ message?: string; data?: T } | void>,
  options: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  await requireAuth();
  try {
    const out = (await fn()) ?? {};
    if (options.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, message: out.message, data: out.data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) {
      const fields = fieldErrors(error);
      return { ok: false, error: Object.values(fields)[0] ?? "Dados inválidos.", fieldErrors: fields };
    }
    if (error instanceof SessionNumberError) {
      return { ok: false, error: error.message, suggestion: error.suggestion };
    }
    if (!(error instanceof UserFacingError)) logServerError(context, error);
    return { ok: false, error: toUserMessage(error) };
  }
}
