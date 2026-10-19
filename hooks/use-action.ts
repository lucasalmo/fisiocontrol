"use client";

import { useCallback, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

/** Runs a Server Action in a transition and reports the outcome as a toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const run = useCallback(
    <T>(
      action: () => Promise<ActionResult<T>>,
      handlers: { onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void; onError?: (result: Extract<ActionResult<T>, { ok: false }>) => void; silent?: boolean } = {},
    ) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) {
            if (result.message && !handlers.silent) toast("success", result.message);
            handlers.onSuccess?.(result);
          } else {
            if (!handlers.onError) toast("error", result.error);
            handlers.onError?.(result);
          }
        } catch {
          toast("error", "Falha de comunicação com o servidor. Verifique sua conexão.");
        }
      });
    },
    [toast],
  );

  return { pending, run };
}
