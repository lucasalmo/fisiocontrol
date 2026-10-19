"use client";

import { Gift, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteBonusAction, deleteCycleAction } from "@/features/cycles/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates/format";
import type { Bonus, Cycle } from "@/types/domain";
import type { FormOptions } from "@/types/options";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { BonusForm } from "./bonus-form";
import { CycleProgress } from "./cycle-progress";
import { PaymentForm } from "./payment-form";

export function CycleCard({
  cycle,
  bonuses,
  options,
  isCurrent,
}: {
  cycle: Cycle;
  bonuses: Bonus[];
  options: FormOptions;
  isCurrent: boolean;
}) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [addingBonus, setAddingBonus] = useState(false);
  const [deletingCycle, setDeletingCycle] = useState(false);
  const [deletingBonus, setDeletingBonus] = useState<Bonus | null>(null);
  const empty = cycle.completedCount + cycle.pendingCount === 0 && bonuses.length === 0;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            Ciclo {cycle.cycleNumber}
            {isCurrent ? <Badge tone="accent">Atual</Badge> : null}
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {cycle.paymentDate ? `Pagamento em ${formatDateBR(cycle.paymentDate)}` : "Sem data de pagamento"}
            {cycle.startDate ? ` · início em ${formatDateBR(cycle.startDate)}` : ""}
            {cycle.firstSessionDate
              ? ` · sessões de ${formatDateBR(cycle.firstSessionDate)} a ${formatDateBR(cycle.lastSessionDate)}`
              : ""}
          </p>
          {cycle.notes ? <p className="mt-1 text-[13px] text-fg-2">{cycle.notes}</p> : null}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAddingBonus(true)}>
            <Gift className="size-4" aria-hidden /> Bônus
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Editar ciclo ${cycle.cycleNumber}`}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Button>
          {empty ? (
            <Button size="icon" variant="ghost" onClick={() => setDeletingCycle(true)} aria-label={`Excluir ciclo ${cycle.cycleNumber}`}>
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <CycleProgress cycle={cycle} />

      {bonuses.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-2 text-[13px] font-medium text-fg-2">Bônus recebidos</h3>
          <ul className="flex flex-col gap-1.5">
            {bonuses.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                <Gift className="size-4 shrink-0 text-accent-text" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    +{b.quantity} {b.quantity === 1 ? "sessão" : "sessões"} · {b.reason}
                  </p>
                  <p className="text-xs text-fg-3">
                    Concedido em {formatDateBR(b.grantedOn)} · registrado em {formatDateTimeBR(b.createdAt)}
                    {b.notes ? ` · ${b.notes}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setDeletingBonus(b)}
                  className="rounded-md p-1.5 text-fg-3 hover:bg-danger-soft hover:text-danger-strong"
                  aria-label={`Remover bônus de ${b.quantity} sessões`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={editing} onClose={() => setEditing(false)} title={`Editar ciclo ${cycle.cycleNumber}`} size="lg">
        <PaymentForm defaultLimit={cycle.baseLimit} today={options.today} cycle={cycle} onDone={() => setEditing(false)} />
      </Dialog>
      <Dialog open={addingBonus} onClose={() => setAddingBonus(false)} title="Registrar sessões bônus" size="lg">
        <BonusForm cycles={options.cycles} today={options.today} defaultCycleId={cycle.id} onDone={() => setAddingBonus(false)} />
      </Dialog>
      <ConfirmDialog
        open={deletingCycle}
        onClose={() => setDeletingCycle(false)}
        title={`Excluir ciclo ${cycle.cycleNumber}?`}
        description="O ciclo não tem sessões nem bônus. Os demais ciclos não serão renumerados."
        confirmLabel="Excluir ciclo"
        pending={pending}
        onConfirm={() => run(() => deleteCycleAction(cycle.id), { onSuccess: () => setDeletingCycle(false) })}
      />
      <ConfirmDialog
        open={!!deletingBonus}
        onClose={() => setDeletingBonus(null)}
        title="Remover bônus?"
        description={
          deletingBonus
            ? `O limite do ciclo ${cycle.cycleNumber} diminuirá em ${deletingBonus.quantity}. Não é permitido se sessões já ocupam essas vagas.`
            : null
        }
        confirmLabel="Remover"
        pending={pending}
        onConfirm={() => deletingBonus && run(() => deleteBonusAction(deletingBonus.id), { onSuccess: () => setDeletingBonus(null) })}
      />
    </Card>
  );
}
