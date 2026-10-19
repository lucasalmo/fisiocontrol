import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Gift,
  Layers,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { MonthlySessionsChart, RankingBarChart } from "@/components/charts/statistics-charts";
import { CycleProgress } from "@/components/cycles/cycle-progress";
import { DashboardStats, type StatTile } from "@/components/dashboard/dashboard-stats";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SurgeryCounter } from "@/components/dashboard/surgery-counter";
import { KIND_META, UNKNOWN_KIND } from "@/components/events/event-meta";
import { DataError, PageSkeleton } from "@/components/feedback/states";
import { SessionList } from "@/components/sessions/session-list";
import { Alert, Card, CardHeader, EmptyState, buttonClass } from "@/components/ui/primitives";
import { computeCycleProgress, currentCycle } from "@/features/cycles/rules";
import { loadFormOptions } from "@/features/options";
import { computeStatistics } from "@/features/statistics/compute";
import { load } from "@/lib/data/load";
import { addDays, diffInDays, todayIso } from "@/lib/dates/calendar";
import { formatDateBR, formatDateWithWeekday, formatInteger } from "@/lib/dates/format";
import { listCycles } from "@/lib/db/repositories/cycles";
import { getSessionTotals, listStatSessions, listUpcomingEvents } from "@/lib/db/repositories/dashboard";
import { listMilestones, getSettings } from "@/lib/db/repositories/settings";
import { listOverduePending, listRecentCompleted, listUpcomingSessions } from "@/lib/db/repositories/sessions";
import type { TimelineKind } from "@/types/domain";

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function loadDashboard() {
  const settings = await getSettings();
  const today = todayIso(settings.timeZone);
  const [milestones, totals, cycles, upcoming, recent, overdue, events, statSessions, options] = await Promise.all([
    listMilestones(),
    getSessionTotals(),
    listCycles(),
    listUpcomingSessions(today, 5),
    listRecentCompleted(5),
    listOverduePending(today),
    listUpcomingEvents(today, 5),
    listStatSessions(),
    loadFormOptions(),
  ]);
  return { settings, today, milestones, totals, cycles, upcoming, recent, overdue, events, statSessions, options };
}

async function Dashboard() {
  const result = await load("dashboard", loadDashboard);
  if (!result.ok) {
    return (
      <>
        <Header />
        <DataError message={result.error} />
      </>
    );
  }
  const { settings, today, milestones, totals, cycles, upcoming, recent, overdue, events, statSessions, options } = result.data;
  const cycle = currentCycle(cycles);
  const progress = cycle ? computeCycleProgress(cycle) : null;
  const bonusAvailable = cycle && progress ? Math.max(0, cycle.bonusTotal - Math.max(0, progress.used - cycle.baseLimit)) : 0;
  const next = upcoming[0];
  const last = recent[0];

  // Charts: last 12 months only.
  const stats = computeStatistics(statSessions);
  const from = addDays(today, -365).slice(0, 7);
  const monthly = stats.monthly.filter((m) => m.month >= from);

  const tiles: StatTile[] = [
    { label: "Sessões concluídas", value: formatInteger(totals.completed), detail: "em todos os ciclos", icon: CheckCircle2 },
    { label: "Sessões pendentes", value: formatInteger(totals.pending), detail: overdue.length ? `${overdue.length} com data passada` : "agendadas", icon: CircleDashed },
    {
      label: "Saldo disponível",
      value: progress ? formatInteger(progress.balance) : "—",
      detail: progress ? `${progress.available} livres para agendar` : "sem ciclo ativo",
      icon: Wallet,
    },
    {
      label: "Ciclo atual",
      value: cycle && progress ? `${Math.round(progress.progress * 100)}%` : "—",
      detail: cycle && progress ? `ciclo ${cycle.cycleNumber} · ${progress.done}/${cycle.totalLimit}` : undefined,
      icon: Layers,
    },
    {
      label: "Próxima sessão",
      value: next ? formatDateBR(next.sessionDate).slice(0, 5) : "—",
      detail: next
        ? `${diffInDays(today, next.sessionDate) === 0 ? "hoje" : `em ${diffInDays(today, next.sessionDate)} dia(s)`} · sessão ${next.numberInCycle}`
        : "nenhuma agendada",
      icon: CalendarClock,
    },
    {
      label: "Última sessão",
      value: last ? formatDateBR(last.sessionDate).slice(0, 5) : "—",
      detail: last ? `${last.categoryName ?? "sem categoria"} · há ${diffInDays(last.sessionDate, today)} dia(s)` : "nenhuma concluída",
      icon: CalendarCheck2,
    },
    { label: "Ciclos de pagamento", value: formatInteger(cycles.length), detail: cycle?.paymentDate ? `último em ${formatDateBR(cycle.paymentDate)}` : undefined, icon: CreditCard },
    {
      label: "Bônus disponíveis",
      value: formatInteger(bonusAvailable),
      detail: cycle?.bonusTotal ? `${cycle.bonusTotal} recebidos no ciclo atual` : "nenhum no ciclo atual",
      icon: Gift,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Header today={today} actions={<QuickActions options={options} />} />

      <SurgeryCounter surgeryDate={settings.surgeryDate} milestones={milestones} serverToday={today} />

      <DashboardStats tiles={tiles} />

      {overdue.length ? (
        <Alert tone="warning" title={`${overdue.length} sessão(ões) pendente(s) com data passada`}>
          Marque como concluídas ou ajuste as datas na{" "}
          <Link href="/sessions?status=pending&sort=asc" className="font-medium underline">
            lista de sessões
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={cycle ? `Ciclo ${cycle.cycleNumber}` : "Ciclo atual"}
            description="Progresso do ciclo de pagamento atual"
            action={
              <Link href="/cycles" className={buttonClass("ghost", "sm")}>
                Ver ciclos
              </Link>
            }
          />
          <div className="p-4 sm:p-5">
            {cycle ? (
              <CycleProgress cycle={cycle} />
            ) : (
              <EmptyState
                title="Nenhum ciclo cadastrado"
                description="Registre um pagamento ou importe seu histórico para começar."
                action={
                  <Link href="/import" className={buttonClass("primary", "sm")}>
                    Importar histórico
                  </Link>
                }
              />
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Próximos eventos" />
          <div className="p-2 sm:p-3">
            {events.length ? (
              <ul className="flex flex-col">
                {events.map((e) => {
                  const meta = KIND_META[e.kind as TimelineKind] ?? UNKNOWN_KIND;
                  const Icon = meta.icon;
                  return (
                    <li key={e.key} className="flex items-center gap-3 rounded-lg px-2 py-2">
                      <span className={`grid size-7 place-items-center rounded-md ${meta.chip}`}>
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-fg-3">
                          {meta.label} · {formatDateWithWeekday(e.date)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="Nenhum evento futuro" />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Próximas sessões"
            action={
              <Link href="/sessions?status=pending&sort=asc" className={buttonClass("ghost", "sm")}>
                Ver todas
              </Link>
            }
          />
          <div className="pt-2 pb-1">
            <SessionList sessions={upcoming} options={options} compact emptyTitle="Nenhuma sessão agendada" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Últimas sessões concluídas"
            action={
              <Link href="/timeline" className={buttonClass("ghost", "sm")}>
                Linha do tempo
              </Link>
            }
          />
          <div className="pt-2 pb-1">
            <SessionList sessions={recent} options={options} compact emptyTitle="Nenhuma sessão concluída" />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MonthlySessionsChart data={monthly} description="Últimos 12 meses" />
        <RankingBarChart
          title="Distribuição por tipo de treino"
          description="Sessões concluídas por categoria"
          data={stats.byCategory.slice(0, 8)}
          valueLabel="Sessões"
          showShare
        />
      </div>
    </div>
  );
}

function Header({ today, actions }: { today?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-1 text-sm text-fg-3">{today ? formatDateWithWeekday(today) : "Resumo do tratamento"}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
