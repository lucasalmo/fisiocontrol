"use client";

import { useState } from "react";
import { saveEventAction } from "@/features/events/actions";
import { useAction } from "@/hooks/use-action";
import type { EventType, TreatmentEvent } from "@/types/domain";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { EVENT_TYPE_LABELS } from "./event-meta";

const DEFAULT_TITLES: Record<EventType, string> = {
  surgery: "Cirurgia",
  holiday: "Feriado",
  pause: "Pausa no tratamento",
  resume: "Retorno ao tratamento",
  custom: "",
};

/**
 * Special events. Payments and bonuses are registered through their own forms
 * because they change cycle limits.
 */
export function EventForm({
  event,
  defaultDate,
  onDone,
  onChooseOther,
}: {
  event?: TreatmentEvent;
  defaultDate: string;
  onDone: () => void;
  /** Lets the parent switch to the payment / bonus form. */
  onChooseOther?: (kind: "payment" | "bonus") => void;
}) {
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [type, setType] = useState<EventType>(event?.type ?? "holiday");
  const [title, setTitle] = useState(event?.title ?? DEFAULT_TITLES.holiday);

  return (
    <form
      action={(fd) => run(() => saveEventAction(fd), { onSuccess: onDone, onError: (r) => setErrors(r.fieldErrors ?? {}) })}
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <Field label="Tipo" htmlFor="event-type">
        <Select
          id="event-type"
          name="type"
          value={type}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "payment" || value === "bonus") {
              onChooseOther?.(value);
              return;
            }
            const next = value as EventType;
            if (!title || title === DEFAULT_TITLES[type]) setTitle(DEFAULT_TITLES[next]);
            setType(next);
          }}
        >
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
          {!event && onChooseOther ? (
            <>
              <option value="payment">Pagamento (novo ciclo)…</option>
              <option value="bonus">Bônus de sessões…</option>
            </>
          ) : null}
        </Select>
      </Field>
      <Field label="Data" htmlFor="eventDate" error={errors.eventDate}>
        <Input id="eventDate" name="eventDate" type="date" required defaultValue={event?.eventDate ?? defaultDate} />
      </Field>
      <Field label="Título" htmlFor="title" error={errors.title} className="sm:col-span-2">
        <Input id="title" name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Descrição (opcional)" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" rows={2} defaultValue={event?.description ?? ""} />
      </Field>
      {type === "holiday" ? (
        <p className="text-[13px] text-fg-3 sm:col-span-2">Feriados não geram sessões nem contam como sessão concluída.</p>
      ) : null}
      {type === "surgery" ? (
        <p className="text-[13px] text-fg-3 sm:col-span-2">
          Editar a data da cirurgia de referência recalcula o contador sem alterar sessões ou outros eventos.
        </p>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : event ? "Salvar evento" : "Adicionar evento"}
        </Button>
      </div>
    </form>
  );
}
