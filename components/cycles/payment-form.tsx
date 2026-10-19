"use client";

import { useState } from "react";
import { registerPaymentAction, updateCycleAction } from "@/features/cycles/actions";
import { useAction } from "@/hooks/use-action";
import type { Cycle } from "@/types/domain";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui/primitives";

/** Registers a payment (opens a new cycle) or edits an existing cycle. */
export function PaymentForm({
  defaultLimit,
  defaultExtra,
  today,
  cycle,
  onDone,
}: {
  defaultLimit: number;
  defaultExtra: number;
  today: string;
  cycle?: Cycle;
  onDone: () => void;
}) {
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      action={(fd) =>
        run(() => (cycle ? updateCycleAction(fd) : registerPaymentAction(fd)), {
          onSuccess: onDone,
          onError: (r) => {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.fieldErrors ? null : r.error);
          },
        })
      }
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      {cycle ? <input type="hidden" name="id" value={cycle.id} /> : null}
      <Field label="Data do pagamento" htmlFor="paymentDate" error={errors.paymentDate}>
        <Input
          id="paymentDate"
          name="paymentDate"
          type="date"
          required={!cycle}
          defaultValue={cycle ? (cycle.paymentDate ?? "") : today}
        />
      </Field>
      <Field label="Sessões liberadas (limite inicial)" htmlFor="baseLimit" error={errors.baseLimit}>
        <Input id="baseLimit" name="baseLimit" type="number" min={1} max={1000} required defaultValue={cycle?.baseLimit ?? defaultLimit} />
      </Field>
      <Field
        label="Sessões extras permitidas"
        htmlFor="extraAllowance"
        error={errors.extraAllowance}
        hint="Aceitas além do limite, sem bônus (ex.: 40 + 3 = até a 43ª)."
      >
        <Input
          id="extraAllowance"
          name="extraAllowance"
          type="number"
          min={0}
          max={100}
          required
          defaultValue={cycle?.extraAllowance ?? defaultExtra}
        />
      </Field>
      <Field
        label="Início do ciclo (opcional)"
        htmlFor="startDate"
        error={errors.startDate}
        hint="Não precisa coincidir com o pagamento."
      >
        <Input id="startDate" name="startDate" type="date" defaultValue={cycle?.startDate ?? ""} />
      </Field>
      <Field label="Observações" htmlFor="cycle-notes" className="sm:col-span-2">
        <Textarea id="cycle-notes" name="notes" rows={2} defaultValue={cycle?.notes ?? ""} />
      </Field>
      {!cycle ? (
        <p className="text-[13px] text-fg-3 sm:col-span-2">
          Um novo ciclo será aberto com numeração local a partir de 1. Os ciclos anteriores e suas sessões não são alterados.
        </p>
      ) : null}
      {formError ? (
        <Alert tone="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : cycle ? "Salvar ciclo" : "Registrar pagamento"}
        </Button>
      </div>
    </form>
  );
}
