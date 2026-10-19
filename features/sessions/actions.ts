"use server";

import { runAction } from "@/lib/actions/result";
import {
  createSession,
  deleteSession,
  setSessionStatus,
  updateSession,
} from "@/lib/db/repositories/sessions";
import { formToObject, idSchema, sessionInputSchema } from "@/lib/validation/schemas";
import type { SessionStatus } from "@/types/domain";

export async function saveSessionAction(formData: FormData) {
  return runAction("saveSession", async () => {
    const raw = formToObject(formData);
    const input = sessionInputSchema.parse(raw);
    if (raw.id) {
      await updateSession(idSchema.parse(raw.id), input);
      return { message: "Sessão atualizada." };
    }
    await createSession(input);
    return { message: "Sessão cadastrada." };
  });
}

export async function setSessionStatusAction(id: number, status: SessionStatus) {
  return runAction("setSessionStatus", async () => {
    await setSessionStatus(idSchema.parse(id), status === "completed" ? "completed" : "pending");
    return { message: status === "completed" ? "Sessão concluída." : "Sessão reaberta." };
  });
}

export async function deleteSessionAction(id: number) {
  return runAction("deleteSession", async () => {
    await deleteSession(idSchema.parse(id));
    return { message: "Sessão excluída." };
  });
}
