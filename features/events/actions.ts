"use server";

import { runAction } from "@/lib/actions/result";
import { createEventTx, deleteEvent, updateEvent } from "@/lib/db/repositories/events";
import { setReferenceSurgeryEvent } from "@/lib/db/repositories/settings";
import { eventInputSchema, formToObject, idSchema } from "@/lib/validation/schemas";

export async function saveEventAction(formData: FormData) {
  return runAction("saveEvent", async () => {
    const raw = formToObject(formData);
    const input = eventInputSchema.parse(raw);
    if (raw.id) {
      await updateEvent(idSchema.parse(raw.id), input);
      return { message: "Evento atualizado." };
    }
    await createEventTx(input);
    return { message: "Evento cadastrado." };
  });
}

export async function deleteEventAction(id: number) {
  return runAction("deleteEvent", async () => {
    await deleteEvent(idSchema.parse(id));
    return { message: "Evento excluído." };
  });
}

export async function setReferenceSurgeryAction(id: number) {
  return runAction("setReferenceSurgery", async () => {
    await setReferenceSurgeryEvent(idSchema.parse(id));
    return { message: "Cirurgia de referência atualizada." };
  });
}
