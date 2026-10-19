"use server";

import { runAction } from "@/lib/actions/result";
import {
  createCategory,
  deleteUnusedCategory,
  setCategoryActive,
  updateCategory,
} from "@/lib/db/repositories/categories";
import {
  createMilestone,
  deleteMilestone,
  updateGeneralSettings,
  updateSurgeryDate,
} from "@/lib/db/repositories/settings";
import {
  categoryInputSchema,
  formToObject,
  idSchema,
  isoDate,
  milestoneInputSchema,
  settingsInputSchema,
} from "@/lib/validation/schemas";

export async function updateSurgeryDateAction(formData: FormData) {
  return runAction("updateSurgeryDate", async () => {
    await updateSurgeryDate(isoDate.parse(formData.get("surgeryDate")));
    return { message: "Data da cirurgia atualizada. Os indicadores foram recalculados." };
  });
}

export async function updateGeneralSettingsAction(formData: FormData) {
  return runAction("updateGeneralSettings", async () => {
    await updateGeneralSettings(settingsInputSchema.parse(formToObject(formData)));
    return { message: "Configurações salvas." };
  });
}

export async function addMilestoneAction(formData: FormData) {
  return runAction("addMilestone", async () => {
    const input = milestoneInputSchema.parse(formToObject(formData));
    await createMilestone(input.days, input.label ?? null);
    return { message: "Marco adicionado." };
  });
}

export async function deleteMilestoneAction(id: number) {
  return runAction("deleteMilestone", async () => {
    await deleteMilestone(idSchema.parse(id));
    return { message: "Marco removido." };
  });
}

export async function saveCategoryAction(formData: FormData) {
  return runAction("saveCategory", async () => {
    const raw = formToObject(formData);
    const input = categoryInputSchema.parse(raw);
    if (raw.id) {
      await updateCategory(idSchema.parse(raw.id), input.name, input.color);
      return { message: "Categoria atualizada." };
    }
    await createCategory(input.name, input.color);
    return { message: "Categoria criada." };
  });
}

export async function setCategoryActiveAction(id: number, active: boolean) {
  return runAction("setCategoryActive", async () => {
    await setCategoryActive(idSchema.parse(id), Boolean(active));
    return { message: active ? "Categoria reativada." : "Categoria desativada." };
  });
}

export async function deleteCategoryAction(id: number) {
  return runAction("deleteCategory", async () => {
    await deleteUnusedCategory(idSchema.parse(id));
    return { message: "Categoria excluída." };
  });
}
