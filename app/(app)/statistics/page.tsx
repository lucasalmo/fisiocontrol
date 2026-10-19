import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CategoryByMonthChart,
  CycleHistoryChart,
  MonthlySessionsChart,
  RankingBarChart,
  WeeklyChart,
} from "@/components/charts/statistics-charts";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { DataError, PageSkeleton } from "@/components/feedback/states";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { computeStatistics } from "@/features/statistics/compute";
import { load } from "@/lib/data/load";
import { formatDateBR, formatDecimal, formatInteger, formatPercent } from "@/lib/dates/format";
import { listStatSessions } from "@/lib/db/repositories/dashboard";
import { CalendarRange, CheckCircle2, Repeat, Timer } from "lucide-react";

export const metadata: Metadata = { title: "Estatísticas" };

export default function StatisticsPage() {
  return (
    <>
      <PageHeader
        title="Estatísticas"
        description="Indicadores de frequência calculados a partir das sessões concluídas. Não representam avaliação clínica."
      />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <StatisticsContent />
      </Suspense>
    </>
  );
}

async function StatisticsContent() {
  const result = await load("statistics", listStatSessions);
  if (!result.ok) return <DataError message={result.error} />;
  const stats = computeStatistics(result.data);
  const fmtDays = (n: number | null) => (n === null ? "—" : `${formatDecimal(n)} dias`);

  return (
    <div className="flex flex-col gap-5">
      <DashboardStats
        tiles={[
          { label: "Sessões concluídas", value: formatInteger(stats.totals.completed), detail: `${stats.totals.pending} pendentes`, icon: CheckCircle2 },
          {
            label: "Média por semana",
            value: stats.averagePerWeek === null ? "—" : formatDecimal(stats.averagePerWeek),
            detail: "no período com sessões",
            icon: Repeat,
          },
          { label: "Intervalo médio", value: fmtDays(stats.intervals.averageDays), detail: `mediana ${fmtDays(stats.intervals.medianDays)}`, icon: Timer },
          { label: "Maior intervalo", value: fmtDays(stats.intervals.longestGapDays), detail: "entre sessões concluídas", icon: CalendarRange },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <MonthlySessionsChart data={stats.monthly} />
        <WeeklyChart data={stats.weekly} />
        <RankingBarChart
          title="Frequência por categoria"
          description="Categorias mais utilizadas (sessões concluídas)"
          data={stats.byCategory}
          valueLabel="Sessões"
          showShare
        />
        <RankingBarChart
          title="Distribuição por dia da semana"
          data={stats.byWeekday.map((d) => ({ name: d.weekday, count: d.completed }))}
          valueLabel="Sessões"
        />
        <CategoryByMonthChart months={stats.categoryByMonth.months} series={stats.categoryByMonth.series} />
        <CycleHistoryChart data={stats.perCycle} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Tipos de treino por dia da semana"
            description="Padrões observados nos dados — não há tipo fixo por dia."
          />
          <div className="overflow-x-auto p-4 sm:p-5">
            <table className="w-full text-left text-[13px]">
              <thead className="text-fg-3">
                <tr>
                  <th className="pr-4 pb-2 font-medium">Dia</th>
                  <th className="pr-4 pb-2 font-medium">Sessões</th>
                  <th className="pr-4 pb-2 font-medium">Categorias mais frequentes</th>
                </tr>
              </thead>
              <tbody>
                {stats.weekdayCategories.map((d) => (
                  <tr key={d.weekday} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium">{d.weekday}</td>
                    <td className="py-2 pr-4 tabular">{d.total}</td>
                    <td className="py-2 text-fg-2">
                      {d.top.length ? d.top.map((t) => `${t.name} (${formatPercent(t.share)})`).join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Categorias utilizadas mais recentemente" />
          <ul className="divide-y divide-border p-2">
            {stats.recentCategories.length ? (
              stats.recentCategories.map((c) => (
                <li key={c.name} className="flex items-center justify-between px-2 py-2 text-[13px]">
                  <span className="flex items-center gap-2 font-medium">
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                  <span className="text-fg-3">{formatDateBR(c.lastDate)}</span>
                </li>
              ))
            ) : (
              <li className="px-2 py-6 text-center text-[13px] text-fg-3">Sem sessões com categoria.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
