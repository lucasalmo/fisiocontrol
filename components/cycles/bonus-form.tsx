"use client";

import { useState } from "react";
import { createBonusAction } from "@/features/cycles/actions";
import { useAction } from "@/hooks/use-action";
import type { CycleOption } from "@/types/options";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";

export function BonusForm({
  cycles,
  today,
  defaultCycleId,
  onDone,
}: {
  cycles: CycleOption[];
  today: string;
  defaultCycleId?: number;
  onDone: () => void;
}) {
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      action={(fd) => run(() => createBonusAction(fd), { onSuccess: onDone, onError: (r) => setErrors(r.fieldErrors ?? {}) })}
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      <Field label="Ciclo" htmlFor="bonus-cycle" error={errors.cycleId}>
        <Select id="bonus-cycle" name="cycleId" defaultValue={defaultCycleId ?? cycles.at(-1)?.id}>
          {[...cycles].reverse().map((c) => (
            <option key={c.id} value={c.id}>
              Ciclo {c.cycleNumber} (limite atual {c.totalLimit})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantidade de sessões" htmlFor="quantity" error={errors.quantity}>
        <Input id="quantity" name="quantity" type="number" min={1} max={100} defaultValue={1} required />
      </Field>
      <Field label="Data da concessão" htmlFor="grantedOn" error={errors.grantedOn}>
        <Input id="grantedOn" name="grantedOn" type="date" defaultValue={today} required />
      </Field>
      <Field label="Motivo" htmlFor="reason" error={errors.reason}>
        <Input id="reason" name="reason" placeholder="Ex.: zerar o eletro" required maxLength={300} />
      </Field>
      <Field label="Observações" htmlFor="bonus-notes" className="sm:col-span-2">
        <Textarea id="bonus-notes" name="notes" rows={2} />
      </Field>
      <p className="text-[13px] text-fg-3 sm:col-span-2">
        O bônus é somado uma única vez ao limite do ciclo escolhido.
      </p>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : "Registrar bônus"}
        </Button>
      </div>
    </form>
  );
}
