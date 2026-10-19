import { z } from "zod";
import { isIsoDate } from "@/lib/dates/calendar";
import { EVENT_TYPES } from "@/types/domain";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const isoDate = z.string().trim().refine(isIsoDate, { message: "Data inválida." });

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional());

const optionalId = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional());

const positiveInt = (label: string, max: number) =>
  z.coerce
    .number({ message: `${label} deve ser um número.` })
    .int(`${label} deve ser um número inteiro.`)
    .min(1, `${label} deve ser maior que zero.`)
    .max(max, `${label} deve ser no máximo ${max}.`);

export const idSchema = z.coerce.number().int().positive();

export const sessionInputSchema = z.object({
  cycleId: idSchema,
  // Optional: when omitted the next free number in the cycle is used.
  numberInCycle: z.preprocess(emptyToUndefined, positiveInt("Número da sessão", 1000).optional()),
  sessionDate: isoDate,
  status: z.enum(["pending", "completed"]),
  categoryId: optionalId,
  notes: optionalText(2000),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

export const paymentInputSchema = z.object({
  paymentDate: isoDate,
  startDate: z.preprocess(emptyToUndefined, isoDate.optional()),
  baseLimit: positiveInt("Limite de sessões", 1000),
  notes: optionalText(2000),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const cycleUpdateSchema = z.object({
  id: idSchema,
  paymentDate: z.preprocess(emptyToUndefined, isoDate.optional()),
  startDate: z.preprocess(emptyToUndefined, isoDate.optional()),
  baseLimit: positiveInt("Limite de sessões", 1000),
  notes: optionalText(2000),
});
export type CycleUpdate = z.infer<typeof cycleUpdateSchema>;

export const bonusInputSchema = z.object({
  cycleId: idSchema,
  quantity: positiveInt("Quantidade", 100),
  grantedOn: isoDate,
  reason: z.string().trim().min(1, "Informe o motivo.").max(300),
  notes: optionalText(2000),
});
export type BonusInput = z.infer<typeof bonusInputSchema>;

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(120, "Máximo de 120 caracteres."),
  type: z.enum(EVENT_TYPES),
  eventDate: isoDate,
  description: optionalText(2000),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(60, "Máximo de 60 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
    .default("#64748b"),
});

export const milestoneInputSchema = z.object({
  days: positiveInt("Dias", 3650),
  label: optionalText(60),
});

export const settingsInputSchema = z.object({
  defaultCycleLimit: positiveInt("Limite padrão", 1000),
  timeZone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido."),
});

export const sessionFiltersSchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(["pending", "completed"]).optional()),
  category: z.preprocess(emptyToUndefined, z.union([z.literal("none"), z.coerce.number().int().positive()]).optional()),
  cycle: optionalId,
  from: z.preprocess(emptyToUndefined, isoDate.optional()),
  to: z.preprocess(emptyToUndefined, isoDate.optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10_000).optional()),
});
export type SessionFilters = z.infer<typeof sessionFiltersSchema>;

/** Extracts `{ field: firstMessage }` from a ZodError. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
