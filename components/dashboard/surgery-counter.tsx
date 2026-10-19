"use client";

import { CalendarClock, HeartPulse } from "lucide-react";
import Link from "next/link";
import { computeSurgeryCounter, type Milestone } from "@/features/surgery/counter";
import { useLocalToday } from "@/hooks/use-local-today";
import { formatDateBR, formatInteger, pluralize } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/calendar";
import { Card } from "@/components/ui/primitives";
import { MilestoneProgress } from "./milestone-progress";

export function SurgeryCounter({
  surgeryDate,
  milestones,
  serverToday,
}: {
  surgeryDate: IsoDate | null;
  milestones: Milestone[];
  serverToday: IsoDate;
}) {
  const today = useLocalToday(serverToday);

  if (!surgeryDate) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HeartPulse className="size-4 text-accent-text" aria-hidden /> Tempo desde a cirurgia
        </div>
        <p className="mt-2 text-sm text-fg-3">
          Nenhuma data de cirurgia definida.{" "}
          <Link href="/settings" className="font-medium text-accent-text underline-offset-2 hover:underline">
            Definir nas configurações
          </Link>
        </p>
      </Card>
    );
  }

  const c = computeSurgeryCounter(surgeryDate, today, milestones);

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-fg-2">
            <HeartPulse className="size-4 text-accent-text" aria-hidden />
            Tempo desde a cirurgia
          </p>
          {c.status === "past" ? (
            <>
              <p className="mt-3 flex items-baseline gap-2" aria-live="polite">
                <span className="text-5xl font-semibold tracking-tight text-fg sm:text-6xl">
                  {formatInteger(c.elapsedDays)}
                </span>
                <span className="text-lg text-fg-2">{c.elapsedDays === 1 ? "dia decorrido" : "dias decorridos"}</span>
              </p>
              <p className="mt-2 text-sm text-fg-2">
                {pluralize(c.weeks, "semana", "semanas")}
                {c.remainingDaysInWeek ? ` e ${pluralize(c.remainingDaysInWeek, "dia", "dias")}` : ""}
                {c.months > 0 ? (
                  <span className="text-fg-3">
                    {" "}
                    · {pluralize(c.months, "mês", "meses")}
                    {c.remainingDaysInMonth ? ` e ${pluralize(c.remainingDaysInMonth, "dia", "dias")}` : ""}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-[13px] text-fg-3">
                Cirurgia realizada em {formatDateBR(surgeryDate)} (dia 0) · hoje é o{" "}
                <span title="Contagem inclusiva: o dia da cirurgia é o 1º dia do calendário pós-operatório">
                  {formatInteger(c.postOpCalendarDay)}º dia do calendário pós-operatório
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight sm:text-6xl">{formatInteger(c.daysUntil)}</span>
                <span className="text-lg text-fg-2">{c.daysUntil === 1 ? "dia para a cirurgia" : "dias para a cirurgia"}</span>
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-3">
                <CalendarClock className="size-4" aria-hidden /> Cirurgia agendada para {formatDateBR(surgeryDate)}
              </p>
            </>
          )}
        </div>
        {c.status === "past" ? (
          <div className="w-full md:max-w-xs">
            <MilestoneProgress summary={c.milestones} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
