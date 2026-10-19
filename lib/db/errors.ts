import { DatabaseNotConfiguredError } from "./client";

/** Error safe to show to the user (never contains SQL or connection details). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

type PgLikeError = { code?: string; constraint?: string };

const CONSTRAINT_MESSAGES: Record<string, string> = {
  sessions_unique_number_in_cycle: "Já existe uma sessão com esse número neste ciclo.",
  sessions_within_cycle_limit: "O número da sessão ultrapassa o limite do ciclo (limite inicial + bônus).",
  cycle_limit_below_sessions:
    "A alteração deixaria sessões acima do limite do ciclo. Ajuste ou mova essas sessões antes.",
  sessions_global_number_key: "Já existe uma sessão com esse número global.",
  payment_cycles_cycle_number_key: "Já existe um ciclo com esse número.",
  session_categories_normalized_name_key: "Já existe uma categoria com esse nome.",
  milestones_days_key: "Esse marco já está cadastrado.",
};

/** Maps any thrown error to a message safe for the UI. */
export function toUserMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof DatabaseNotConfiguredError) {
    return "Banco de dados não configurado. Defina DATABASE_URL em .env.local.";
  }
  const pg = error as PgLikeError;
  if (pg?.constraint && CONSTRAINT_MESSAGES[pg.constraint]) return CONSTRAINT_MESSAGES[pg.constraint];
  switch (pg?.code) {
    case "23505":
      return "Registro duplicado.";
    case "23503":
      return "O registro está vinculado a outros dados e não pode ser removido.";
    case "23514":
      return "Os dados violam uma regra de integridade.";
    case "40001":
    case "40P01":
      return "Conflito de concorrência. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Verifique a conexão com o banco e tente novamente.";
}

/** Logs server-side without leaking connection strings. */
export function logServerError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgres://***");
  const code = (error as PgLikeError)?.code;
  console.error(`[fisiocontrol] ${context}: ${redacted}${code ? ` (code ${code})` : ""}`);
}
