"use server";

import { runAction } from "@/lib/actions/result";
import { createBonus, deleteBonus, deleteCycle, registerPayment, updateCycle } from "@/lib/db/repositories/cycles";
import {
  bonusInputSchema,
  cycleUpdateSchema,
  formToObject,
  idSchema,
  paymentInputSchema,
} from "@/lib/validation/schemas";

export async function registerPaymentAction(formData: FormData) {
  return runAction("registerPayment", async () => {
    const created = await registerPayment(paymentInputSchema.parse(formToObject(formData)));
    return { message: `Pagamento registrado. Ciclo ${created.cycleNumber} aberto.` };
  });
}

export async function updateCycleAction(formData: FormData) {
  return runAction("updateCycle", async () => {
    await updateCycle(cycleUpdateSchema.parse(formToObject(formData)));
    return { message: "Ciclo atualizado." };
  });
}

export async function deleteCycleAction(id: number) {
  return runAction("deleteCycle", async () => {
    await deleteCycle(idSchema.parse(id));
    return { message: "Ciclo excluído." };
  });
}

export async function createBonusAction(formData: FormData) {
  return runAction("createBonus", async () => {
    const input = bonusInputSchema.parse(formToObject(formData));
    await createBonus(input);
    return { message: `${input.quantity} ${input.quantity === 1 ? "sessão bônus registrada" : "sessões bônus registradas"}.` };
  });
}

export async function deleteBonusAction(id: number) {
  return runAction("deleteBonus", async () => {
    await deleteBonus(idSchema.parse(id));
    return { message: "Bônus removido." };
  });
}
