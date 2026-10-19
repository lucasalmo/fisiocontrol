"use client";

import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { Session } from "@/types/domain";
import { formatDateWithWeekday } from "@/lib/dates/format";
import { cn } from "@/lib/utils/text";
import { SessionTypeBadge } from "./session-type-badge";

export function SessionCard({
  session,
  today,
  pending,
  onToggle,
  onEdit,
  onDelete,
  compact = false,
}: {
  session: Session;
  today: string;
  pending?: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const done = session.status === "completed";
  const overdue = !done && session.sessionDate < today;
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/60 sm:px-4",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={done ? `Reabrir sessão ${session.numberInCycle}` : `Marcar sessão ${session.numberInCycle} como concluída`}
        title={done ? "Reabrir sessão" : "Marcar como concluída"}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
          done
            ? "border-transparent bg-success text-white dark:text-black"
            : "border-border-strong text-transparent hover:border-success hover:text-success",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-fg tabular">Sessão {session.numberInCycle}</span>
          <span className="text-xs text-fg-3 tabular">
            ciclo {session.cycleNumber}
            {session.globalNumber ? ` · #${session.globalNumber}` : ""}
          </span>
          {!compact ? <SessionTypeBadge name={session.categoryName} color={session.categoryColor} /> : null}
          {overdue ? (
            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">atrasada</span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-fg-3">
          {formatDateWithWeekday(session.sessionDate)}
          {compact && session.categoryName ? ` · ${session.categoryName}` : ""}
          {session.notes && !compact ? ` · ${session.notes}` : ""}
        </p>
      </div>
      {onEdit || onDelete ? (
        <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {done ? (
            <button
              onClick={onToggle}
              disabled={pending}
              className="rounded-md p-1.5 text-fg-3 hover:bg-surface-hover hover:text-fg"
              aria-label={`Reabrir sessão ${session.numberInCycle}`}
              title="Reabrir"
            >
              <RotateCcw className="size-4" />
            </button>
          ) : null}
          {onEdit ? (
            <button
              onClick={onEdit}
              className="rounded-md p-1.5 text-fg-3 hover:bg-surface-hover hover:text-fg"
              aria-label={`Editar sessão ${session.numberInCycle}`}
              title="Editar"
            >
              <Pencil className="size-4" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-fg-3 hover:bg-danger-soft hover:text-danger-strong"
              aria-label={`Excluir sessão ${session.numberInCycle}`}
              title="Excluir"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
