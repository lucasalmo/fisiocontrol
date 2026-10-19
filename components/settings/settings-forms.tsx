"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  addMilestoneAction,
  deleteMilestoneAction,
  updateGeneralSettingsAction,
  updateSurgeryDateAction,
} from "@/features/settings/actions";
import { summarizeMilestones } from "@/features/surgery/counter";
import { useAction } from "@/hooks/use-action";
import { useLocalToday } from "@/hooks/use-local-today";
import { diffInDays, type IsoDate } from "@/lib/dates/calendar";
import type { MilestoneRow } from "@/types/domain";
import { MilestoneProgress } from "@/components/dashboard/milestone-progress";
import { Button, Field, Input } from "@/components/ui/primitives";

export function SurgeryDateForm({ surgeryDate }: { surgeryDate: IsoDate | null }) {
  const { pending, run } = useAction();
  const [error, setError] = useState<string>();
  return (
    <form
      action={(fd) => run(() => updateSurgeryDateAction(fd), { onError: (r) => setError(r.error), onSuccess: () => setError(undefined) })}
      className="flex flex-wrap items-end gap-3"
    >
      <Field label="Data da cirurgia" htmlFor="surgeryDate" error={error} hint="Altera apenas o contador; sessões e eventos mantêm suas datas.">
        <Input id="surgeryDate" name="surgeryDate" type="date" required defaultValue={surgeryDate ?? ""} className="w-auto" />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar data"}
      </Button>
    </form>
  );
}

export function MilestonesForm({
  milestones,
  surgeryDate,
  serverToday,
}: {
  milestones: MilestoneRow[];
  surgeryDate: IsoDate | null;
  serverToday: IsoDate;
}) {
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const today = useLocalToday(serverToday);
  const summary = surgeryDate ? summarizeMilestones(surgeryDate, diffInDays(surgeryDate, today), milestones) : null;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 py-1 pr-1 pl-2.5 text-[13px]">
            <span className="tabular">{m.days} dias</span>
            {m.label ? <span className="text-fg-3">· {m.label}</span> : null}
            <button
              onClick={() => run(() => deleteMilestoneAction(m.id))}
              disabled={pending}
              className="rounded p-1 text-fg-3 hover:bg-danger-soft hover:text-danger-strong"
              aria-label={`Remover marco de ${m.days} dias`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        key={formKey}
        action={(fd) =>
          run(() => addMilestoneAction(fd), {
            onSuccess: () => {
              setErrors({});
              setFormKey((k) => k + 1);
            },
            onError: (r) => setErrors(r.fieldErrors ?? { days: r.error }),
          })
        }
        className="flex flex-wrap items-end gap-3"
      >
        <Field label="Dias" htmlFor="m-days" error={errors.days}>
          <Input id="m-days" name="days" type="number" min={1} max={3650} required className="w-28" />
        </Field>
        <Field label="Rótulo (opcional)" htmlFor="m-label">
          <Input id="m-label" name="label" maxLength={60} placeholder="Ex.: 7 meses" className="w-48" />
        </Field>
        <Button type="submit" disabled={pending}>
          Adicionar marco
        </Button>
      </form>
      {summary ? (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-[13px] font-medium text-fg-2">Histórico de marcos</p>
          <MilestoneProgress summary={summary} showHistory />
        </div>
      ) : null}
      <p className="text-xs text-fg-3">Marcos são apenas indicadores de tempo, não garantias de recuperação nem orientação médica.</p>
    </div>
  );
}

export function GeneralSettingsForm({ defaultCycleLimit, timeZone }: { defaultCycleLimit: number; timeZone: string }) {
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      action={(fd) => run(() => updateGeneralSettingsAction(fd), { onError: (r) => setErrors(r.fieldErrors ?? {}), onSuccess: () => setErrors({}) })}
      className="flex flex-wrap items-end gap-3"
    >
      <Field label="Limite padrão de sessões por ciclo" htmlFor="defaultCycleLimit" error={errors.defaultCycleLimit}>
        <Input id="defaultCycleLimit" name="defaultCycleLimit" type="number" min={1} max={1000} defaultValue={defaultCycleLimit} className="w-32" />
      </Field>
      <Field label="Fuso horário" htmlFor="timeZone" error={errors.timeZone} hint="Define “hoje” no servidor.">
        <Input id="timeZone" name="timeZone" defaultValue={timeZone} className="w-56" list="tz-list" />
      </Field>
      <datalist id="tz-list">
        {["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Cuiaba", "America/Rio_Branco", "America/Noronha"].map(
          (tz) => (
            <option key={tz} value={tz} />
          ),
        )}
      </datalist>
      <Button type="submit" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
