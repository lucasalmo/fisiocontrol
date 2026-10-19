"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteEventAction, setReferenceSurgeryAction } from "@/features/events/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateWithWeekday } from "@/lib/dates/format";
import type { TreatmentEvent } from "@/types/domain";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/primitives";
import { EventForm } from "./event-form";
import { KIND_META } from "./event-meta";

export function EventCard({ event, isReference }: { event: TreatmentEvent; isReference: boolean }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = KIND_META[event.type];
  const Icon = meta.icon;

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${meta.chip}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {event.title}
          {isReference ? <Badge tone="accent">Referência do contador</Badge> : null}
        </p>
        <p className="truncate text-[13px] text-fg-3">
          {meta.label} · {formatDateWithWeekday(event.eventDate)}
          {event.description ? ` · ${event.description}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5">
        {event.type === "surgery" && !isReference ? (
          <button
            onClick={() => run(() => setReferenceSurgeryAction(event.id))}
            disabled={pending}
            className="rounded-md p-1.5 text-fg-3 hover:bg-surface-hover hover:text-fg"
            aria-label="Usar como referência do contador"
            title="Usar como referência do contador"
          >
            <Star className="size-4" />
          </button>
        ) : null}
        <button
          onClick={() => setEditing(true)}
          className="rounded-md p-1.5 text-fg-3 hover:bg-surface-hover hover:text-fg"
          aria-label={`Editar ${event.title}`}
        >
          <Pencil className="size-4" />
        </button>
        <button
          onClick={() => setDeleting(true)}
          className="rounded-md p-1.5 text-fg-3 hover:bg-danger-soft hover:text-danger-strong"
          aria-label={`Excluir ${event.title}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar evento" size="lg">
        <EventForm event={event} defaultDate={event.eventDate} onDone={() => setEditing(false)} />
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir evento?"
        description={
          isReference
            ? "Este é o evento de cirurgia usado pelo contador. Ao excluí-lo, o contador ficará sem data até você definir outra nas configurações."
            : `“${event.title}” será removido do calendário e da linha do tempo.`
        }
        confirmLabel="Excluir"
        pending={pending}
        onConfirm={() => run(() => deleteEventAction(event.id), { onSuccess: () => setDeleting(false) })}
      />
    </div>
  );
}
