import { Check, Flag } from "lucide-react";
import type { MilestoneSummary } from "@/features/surgery/counter";
import { formatDateBR, formatInteger } from "@/lib/dates/format";
import { ProgressBar } from "@/components/ui/primitives";

/** Time markers since surgery. Indicators only — not clinical guidance. */
export function MilestoneProgress({ summary, showHistory = false }: { summary: MilestoneSummary; showHistory?: boolean }) {
  const { next, reached, all } = summary;
  return (
    <div className="flex flex-col gap-3">
      {next ? (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-1.5 font-medium text-fg">
              <Flag className="size-3.5 text-accent-text" aria-hidden />
              Próximo marco: {formatInteger(next.days)} dias{next.label ? ` · ${next.label}` : ""}
            </span>
            <span className="text-fg-3">{formatDateBR(next.date)}</span>
          </div>
          <ProgressBar value={next.progress} label={`Progresso até o marco de ${next.days} dias`} />
          <p className="mt-1.5 text-[13px] text-fg-2">
            {next.daysRemaining === 1 ? "Falta 1 dia" : `Faltam ${formatInteger(next.daysRemaining)} dias`} para esse marco
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-fg-2">Todos os marcos configurados foram alcançados.</p>
      )}
      <ol className="flex flex-wrap gap-1.5" aria-label="Marcos temporais">
        {all.map((m) => (
          <li
            key={m.days}
            title={`${m.days} dias — ${formatDateBR(m.date)}${m.reached ? " (alcançado)" : ""}`}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs tabular ${
              m.reached
                ? "border-transparent bg-accent-soft text-accent-text"
                : "border-border text-fg-3"
            }`}
          >
            {m.reached ? <Check className="size-3" aria-label="alcançado" /> : null}
            {m.days}d
          </li>
        ))}
      </ol>
      {showHistory && reached.length ? (
        <ul className="flex flex-col divide-y divide-border text-[13px]">
          {[...reached].reverse().map((m) => (
            <li key={m.days} className="flex justify-between py-1.5">
              <span>
                {m.days} dias{m.label ? ` · ${m.label}` : ""}
              </span>
              <span className="text-fg-3">alcançado em {formatDateBR(m.date)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
