"use client";

import { CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { setSessionStatusAction } from "@/features/sessions/actions";
import { useAction } from "@/hooks/use-action";
import { WEEKDAY_SHORT, addDays, type IsoDate } from "@/lib/dates/calendar";
import { formatDateWithWeekday, formatMonthYear } from "@/lib/dates/format";
import { cn } from "@/lib/utils/text";
import type { TimelineItem } from "@/types/domain";
import type { FormOptions } from "@/types/options";
import { CreateDialogs, type QuickKind } from "@/components/dashboard/quick-actions";
import { KIND_META } from "@/components/events/event-meta";
import { SessionTypeBadge } from "@/components/sessions/session-type-badge";
import { Button, Card, buttonClass } from "@/components/ui/primitives";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function monthHref(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `/calendar?m=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CalendarView({
  year,
  month,
  grid,
  items,
  options,
}: {
  year: number;
  month: number;
  grid: IsoDate[];
  items: TimelineItem[];
  options: FormOptions;
}) {
  const today = options.today;
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const [selected, setSelected] = useState<IsoDate>(today.startsWith(monthPrefix) ? today : `${monthPrefix}-01`);
  const [creating, setCreating] = useState<QuickKind | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { pending, run } = useAction();

  const byDate = new Map<string, TimelineItem[]>();
  for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  const dayItems = byDate.get(selected) ?? [];

  function move(e: KeyboardEvent) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = addDays(selected, delta);
    if (!grid.includes(next)) return;
    setSelected(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold first-letter:uppercase" aria-live="polite">
            {formatMonthYear(year, month)}
          </h2>
          <div className="flex items-center gap-1">
            <Link href={monthHref(year, month, -1)} className={buttonClass("ghost", "icon")} aria-label="Mês anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/calendar" className={buttonClass("secondary", "sm")}>
              Hoje
            </Link>
            <Link href={monthHref(year, month, 1)} className={buttonClass("ghost", "icon")} aria-label="Próximo mês">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
        <div role="grid" aria-label={`Calendário de ${formatMonthYear(year, month)}`} ref={gridRef} onKeyDown={move}>
          <div role="row" className="grid grid-cols-7 pb-1">
            {WEEK_ORDER.map((d) => (
              <div role="columnheader" key={d} className="text-center text-xs font-medium text-fg-3">
                {WEEKDAY_SHORT[d]}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date) => {
              const list = byDate.get(date) ?? [];
              const inMonth = date.startsWith(monthPrefix);
              const isToday = date === today;
              const isSelected = date === selected;
              const surgery = list.some((i) => i.kind === "surgery");
              const label = `${formatDateWithWeekday(date)}: ${list.length ? list.map((i) => i.title).join(", ") : "sem registros"}`;
              return (
                <button
                  key={date}
                  role="gridcell"
                  data-date={date}
                  aria-selected={isSelected}
                  aria-label={label}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelected(date)}
                  className={cn(
                    "flex min-h-14 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-20",
                    inMonth ? "bg-surface" : "bg-transparent text-fg-3",
                    isSelected ? "border-accent ring-2 ring-accent/25" : "border-border hover:border-border-strong",
                    surgery && "bg-danger-soft",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs tabular",
                      isToday ? "bg-accent font-semibold text-white dark:text-black" : inMonth ? "text-fg" : "text-fg-3",
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  <span className="flex flex-wrap gap-0.5" aria-hidden>
                    {list.slice(0, 6).map((i) => (
                      <span
                        key={i.key}
                        className={cn(
                          "size-2 rounded-full",
                          i.kind.startsWith("session") ? "" : KIND_META[i.kind]?.dot,
                        )}
                        style={
                          i.kind === "session-completed"
                            ? { backgroundColor: i.categoryColor ?? "var(--success)" }
                            : i.kind === "session-pending"
                              ? { boxShadow: `inset 0 0 0 1.5px ${i.categoryColor ?? "var(--text-3)"}` }
                              : undefined
                        }
                      />
                    ))}
                    {list.length > 6 ? <span className="text-[10px] text-fg-3">+{list.length - 6}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-3" aria-label="Legenda">
          <li className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-success" /> Sessão concluída (cor da categoria)
          </li>
          <li className="flex items-center gap-1">
            <span className="size-2 rounded-full shadow-[inset_0_0_0_1.5px_var(--text-3)]" /> Sessão pendente
          </li>
          {(["surgery", "payment", "bonus", "holiday", "pause"] as const).map((k) => (
            <li key={k} className="flex items-center gap-1">
              <span className={cn("size-2 rounded-full", KIND_META[k].dot)} /> {KIND_META[k].label}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col p-4">
        <h2 className="text-sm font-semibold">{formatDateWithWeekday(selected)}</h2>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="primary" onClick={() => setCreating("session")}>
            <Plus className="size-3.5" aria-hidden /> Sessão
          </Button>
          <Button size="sm" onClick={() => setCreating("event")}>
            <CalendarPlus className="size-3.5" aria-hidden /> Evento
          </Button>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {dayItems.length ? (
            dayItems.map((i) => {
              const meta = KIND_META[i.kind];
              const Icon = meta.icon;
              const isSession = i.kind.startsWith("session");
              return (
                <li key={i.key} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", meta.chip)}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-fg-3">{[meta.label, i.subtitle].filter(Boolean).join(" · ")}</p>
                    {i.categoryName ? (
                      <div className="mt-1">
                        <SessionTypeBadge name={i.categoryName} color={i.categoryColor} />
                      </div>
                    ) : null}
                    {i.description ? <p className="mt-1 text-xs text-fg-2">{i.description}</p> : null}
                  </div>
                  {isSession ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setSessionStatusAction(i.refId, i.kind === "session-completed" ? "pending" : "completed"),
                        )
                      }
                      aria-label={i.kind === "session-completed" ? `Reabrir ${i.title}` : `Concluir ${i.title}`}
                      title={i.kind === "session-completed" ? "Reabrir" : "Marcar como concluída"}
                    >
                      {i.kind === "session-completed" ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
                    </Button>
                  ) : null}
                </li>
              );
            })
          ) : (
            <li className="py-6 text-center text-[13px] text-fg-3">Nenhum registro nesta data.</li>
          )}
        </ul>
      </Card>
      <CreateDialogs options={options} open={creating} onClose={() => setCreating(null)} onSwitch={setCreating} date={selected} />
    </div>
  );
}
