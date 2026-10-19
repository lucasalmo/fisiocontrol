"use client";

import { ListChecks } from "lucide-react";
import { useOptimistic, useState } from "react";
import { deleteSessionAction, setSessionStatusAction } from "@/features/sessions/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateBR } from "@/lib/dates/format";
import type { Session } from "@/types/domain";
import type { FormOptions } from "@/types/options";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/primitives";
import { SessionCard } from "./session-card";
import { SessionForm } from "./session-form";

export function SessionList({
  sessions,
  options,
  compact = false,
  emptyTitle = "Nenhuma sessão encontrada",
  emptyDescription,
}: {
  sessions: Session[];
  options: FormOptions;
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Optimistic status so a click feels instant.
  const [optimistic, setOptimistic] = useOptimistic(
    sessions,
    (state, update: { id: number; status: Session["status"] }) =>
      state.map((s) => (s.id === update.id ? { ...s, status: update.status } : s)),
  );

  if (!sessions.length) {
    return <EmptyState icon={<ListChecks className="size-5" />} title={emptyTitle} description={emptyDescription} />;
  }

  function toggle(s: Session) {
    const status = s.status === "completed" ? "pending" : "completed";
    setBusyId(s.id);
    run(
      async () => {
        setOptimistic({ id: s.id, status });
        return setSessionStatusAction(s.id, status);
      },
      { onSuccess: () => setBusyId(null), onError: () => setBusyId(null) },
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {optimistic.map((s) => (
          <li key={s.id}>
            <SessionCard
              session={s}
              today={options.today}
              compact={compact}
              pending={pending && busyId === s.id}
              onToggle={() => toggle(s)}
              onEdit={compact ? undefined : () => setEditing(s)}
              onDelete={compact ? undefined : () => setDeleting(s)}
            />
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Editar sessão ${editing?.numberInCycle ?? ""}`} size="lg">
        {editing ? <SessionForm options={options} session={editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Excluir sessão?"
        description={
          deleting ? (
            <>
              A sessão {deleting.numberInCycle} do ciclo {deleting.cycleNumber} ({formatDateBR(deleting.sessionDate)}) será
              excluída permanentemente. Os números das demais sessões não serão alterados.
            </>
          ) : null
        }
        confirmLabel="Excluir"
        pending={pending}
        onConfirm={() => {
          if (!deleting) return;
          run(() => deleteSessionAction(deleting.id), { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}
