import { computeCycleProgress } from "@/features/cycles/rules";
import { formatDateBR, formatInteger, formatPercent } from "@/lib/dates/format";
import type { Cycle } from "@/types/domain";
import { ProgressBar } from "@/components/ui/primitives";

export function CycleProgress({ cycle }: { cycle: Cycle }) {
  const p = computeCycleProgress(cycle);
  const inferred = p.done - p.completed;
  const items = [
    { label: "Concluídas", value: p.completed },
    { label: "Pendentes", value: p.pending },
    { label: "Livres para agendar", value: p.available },
    { label: "Saldo (não realizadas)", value: p.balance },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-fg-2">
          <span className="text-2xl font-semibold text-fg tabular">{formatInteger(p.done)}</span>
          <span className="text-fg-3"> / {formatInteger(p.totalLimit)} sessões</span>
        </p>
        <span className="text-sm font-medium text-fg tabular">{formatPercent(p.progress)}</span>
      </div>
      <ProgressBar value={p.progress} label={`Progresso do ciclo ${cycle.cycleNumber}`} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-fg-3">{i.label}</dt>
            <dd className="font-medium text-fg tabular">{formatInteger(i.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-fg-3">
        Pagamento: {formatDateBR(cycle.paymentDate)} · Limite inicial {cycle.baseLimit}
        {cycle.bonusTotal ? ` + ${cycle.bonusTotal} bônus` : ""}
        {p.isFull ? " · ciclo completo" : ""}
      </p>
      {inferred > 0 ? (
        <p className="text-xs text-fg-3">
          Inclui {inferred} sessões anteriores à sessão {cycle.maxCompletedNumber} não registradas (histórico parcial).
        </p>
      ) : null}
    </div>
  );
}
