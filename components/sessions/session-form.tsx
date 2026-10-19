"use client";

import { useRef, useState } from "react";
import { saveSessionAction } from "@/features/sessions/actions";
import { useAction } from "@/hooks/use-action";
import type { Session } from "@/types/domain";
import type { FormOptions } from "@/types/options";
import { Alert, Button, Field, Input, Select, Textarea, buttonClass } from "@/components/ui/primitives";
import Link from "next/link";

export function SessionForm({
  options,
  session,
  defaultDate,
  onDone,
}: {
  options: FormOptions;
  session?: Session;
  defaultDate?: string;
  onDone: () => void;
}) {
  const { cycles, categories } = options;
  const formRef = useRef<HTMLFormElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<{ message: string; suggestion: number | null } | null>(null);
  const current = cycles.at(-1);
  const [cycleId, setCycleId] = useState<number | undefined>(session?.cycleId ?? current?.id);
  const selected = cycles.find((c) => c.id === cycleId);
  const nextNumber = selected && selected.maxNumber + 1 <= selected.maxAllowed ? selected.maxNumber + 1 : null;
  const isExtra = nextNumber !== null && selected !== undefined && nextNumber > selected.totalLimit;

  if (!cycles.length) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info" title="Nenhum ciclo cadastrado">
          Registre um pagamento para abrir o primeiro ciclo de sessões, ou importe seu histórico.
        </Alert>
        <div className="flex gap-2">
          <Link href="/cycles" className={buttonClass("primary")}>
            Registrar pagamento
          </Link>
          <Link href="/import" className={buttonClass("secondary")}>
            Importar histórico
          </Link>
        </div>
      </div>
    );
  }

  function submit(formData: FormData) {
    setConflict(null);
    run(() => saveSessionAction(formData), {
      onSuccess: () => onDone(),
      onError: (r) => {
        setErrors(r.fieldErrors ?? {});
        if (!r.fieldErrors) setConflict({ message: r.error, suggestion: r.suggestion ?? null });
      },
    });
  }

  const visibleCategories = categories.filter((c) => c.active || c.id === session?.categoryId);

  return (
    <form ref={formRef} action={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {session ? <input type="hidden" name="id" value={session.id} /> : null}
      <Field label="Ciclo" htmlFor="cycleId" error={errors.cycleId}>
        <Select
          id="cycleId"
          name="cycleId"
          value={cycleId}
          onChange={(e) => setCycleId(Number(e.target.value))}
          required
        >
          {[...cycles].reverse().map((c) => (
            <option key={c.id} value={c.id}>
              Ciclo {c.cycleNumber} — {c.registered}/{c.totalLimit} sessões
              {c.maxAllowed > c.totalLimit ? ` (+${c.maxAllowed - c.totalLimit} extras)` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Número no ciclo"
        htmlFor="numberInCycle"
        error={errors.numberInCycle}
        hint={
          session
            ? `Nº global: ${session.globalNumber ?? "—"}`
            : nextNumber
              ? `Vazio = automático (${nextNumber}${isExtra ? ", sessão extra" : ""})`
              : "Ciclo completo"
        }
      >
        <Input
          ref={numberRef}
          id="numberInCycle"
          name="numberInCycle"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={session?.numberInCycle}
          placeholder={nextNumber ? String(nextNumber) : "—"}
          aria-invalid={Boolean(errors.numberInCycle)}
        />
      </Field>
      <Field label="Data" htmlFor="sessionDate" error={errors.sessionDate}>
        <Input
          id="sessionDate"
          name="sessionDate"
          type="date"
          required
          defaultValue={session?.sessionDate ?? defaultDate ?? options.today}
          aria-invalid={Boolean(errors.sessionDate)}
        />
      </Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={session?.status ?? "pending"}>
          <option value="pending">Pendente</option>
          <option value="completed">Concluída</option>
        </Select>
      </Field>
      <Field label="Categoria (opcional)" htmlFor="categoryId" className="sm:col-span-2">
        <Select id="categoryId" name="categoryId" defaultValue={session?.categoryId ?? ""}>
          <option value="">Sem categoria</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active ? "" : " (desativada)"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Observações (opcional)" htmlFor="notes" error={errors.notes} className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={3} defaultValue={session?.notes ?? ""} maxLength={2000} />
      </Field>

      {conflict ? (
        <Alert tone="warning" className="sm:col-span-2" title={conflict.message}>
          {conflict.suggestion ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>Deseja usar o número {conflict.suggestion}?</span>
              <Button
                size="sm"
                onClick={() => {
                  if (numberRef.current) numberRef.current.value = String(conflict.suggestion);
                  formRef.current?.requestSubmit();
                }}
              >
                Usar nº {conflict.suggestion}
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : session ? "Salvar alterações" : "Cadastrar sessão"}
        </Button>
      </div>
    </form>
  );
}
