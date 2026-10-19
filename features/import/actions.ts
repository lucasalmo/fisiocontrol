"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions/result";
import { restoreBackup, parseBackup } from "@/lib/db/repositories/backup";
import { UserFacingError } from "@/lib/db/errors";
import { executeImport, previewImport, type ImportOptions, type ImportPreview, type ImportResult } from "./service";

const MAX_TEXT = 200_000;

const optionsSchema = z.object({
  referenceYear: z.coerce.number().int().min(1990, "Ano de referência inválido.").max(2100, "Ano de referência inválido."),
  excludedLines: z.array(z.number().int().positive()).max(5000).default([]),
  initialCycle: z.union([z.literal("auto"), z.literal("new"), z.number().int().positive()]).default("auto"),
  initialBaseLimit: z.number().int().min(1).max(1000).optional(),
  createCategories: z.boolean().default(true),
});

function validate(text: string, options: unknown): { text: string; options: ImportOptions } {
  if (typeof text !== "string" || !text.trim()) throw new UserFacingError("Cole o histórico antes de continuar.");
  if (text.length > MAX_TEXT) throw new UserFacingError("Texto muito grande para uma importação.");
  return { text, options: optionsSchema.parse(options) };
}

export async function previewImportAction(text: string, options: unknown) {
  return runAction<ImportPreview>(
    "previewImport",
    async () => {
      const v = validate(text, options);
      return { data: await previewImport(v.text, v.options) };
    },
    { revalidate: false },
  );
}

export async function executeImportAction(text: string, options: unknown) {
  return runAction<ImportResult>("executeImport", async () => {
    const v = validate(text, options);
    const result = await executeImport(v.text, v.options);
    return {
      data: result,
      message: `Importação concluída: ${result.sessions} sessões, ${result.cycles} ciclos, ${result.bonuses} bônus e ${result.events} eventos.`,
    };
  });
}

export async function restoreBackupAction(json: string, mode: "empty" | "replace", confirmation: string) {
  return runAction("restoreBackup", async () => {
    if (mode === "replace" && confirmation.trim().toUpperCase() !== "SUBSTITUIR") {
      throw new UserFacingError("Digite SUBSTITUIR para confirmar a substituição completa dos dados.");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new UserFacingError("O arquivo não é um JSON válido.");
    }
    await restoreBackup(parseBackup(parsed), mode === "replace" ? "replace" : "empty");
    return { message: "Backup restaurado com sucesso." };
  });
}
