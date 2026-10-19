"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateBR, formatDecimal, formatInteger, formatMonthShort, formatPercent } from "@/lib/dates/format";
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives";

const AXIS = { stroke: "var(--chart-axis)", fontSize: 12, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />;
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

type TooltipEntry = { name?: unknown; value?: unknown; color?: string; dataKey?: unknown };
type TooltipProps = {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  labelFormatter?: (label: string) => string;
};

function ChartTooltip({ active, payload, label, labelFormatter }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-fg">{labelFormatter ? labelFormatter(String(label)) : String(label)}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2 text-fg-2">
            <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
            <span>{String(p.name)}</span>
            <span className="ml-auto pl-3 font-medium text-fg tabular">
              {typeof p.value === "number" ? formatDecimal(p.value) : String(p.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const legendFormatter = (value: string) => <span className="text-xs text-fg-2">{value}</span>;

/** Card + chart + accessible table view. */
export function ChartCard({
  title,
  description,
  empty,
  table,
  children,
  height = 260,
}: {
  title: string;
  description?: string;
  empty?: boolean;
  table: { headers: string[]; rows: (string | number)[][] };
  children: ReactNode;
  height?: number;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} description={description} />
      <div className="px-2 pt-3 pb-2 sm:px-4">
        {empty ? (
          <EmptyState title="Sem dados suficientes" description="Os gráficos aparecem quando houver sessões concluídas." />
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>
      {!empty ? (
        <details className="border-t border-border px-4 py-2.5 text-[13px] sm:px-5">
          <summary className="cursor-pointer text-fg-3 hover:text-fg">Ver dados em tabela</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left tabular">
              <thead className="text-fg-3">
                <tr>
                  {table.headers.map((h) => (
                    <th key={h} className="py-1 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-fg-2">
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {row.map((cell, j) => (
                      <td key={j} className="py-1 pr-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}

export function MonthlySessionsChart({
  data,
  title = "Sessões por mês",
  description,
  height,
}: {
  data: { month: string; completed: number; pending: number }[];
  title?: string;
  description?: string;
  height?: number;
}) {
  return (
    <ChartCard
      title={title}
      description={description}
      empty={!data.some((d) => d.completed || d.pending)}
      height={height}
      table={{
        headers: ["Mês", "Concluídas", "Pendentes"],
        rows: data.map((d) => [formatMonthShort(d.month), d.completed, d.pending]),
      }}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="25%">
          {GRID}
          <XAxis dataKey="month" tickFormatter={formatMonthShort} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} labelFormatter={formatMonthShort} />}
          />
          <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
          <Bar dataKey="completed" name="Concluídas" stackId="a" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth={1} />
          <Bar
            dataKey="pending"
            name="Pendentes"
            stackId="a"
            fill="var(--series-muted)"
            stroke="var(--chart-surface)"
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WeeklyChart({ data }: { data: { weekStart: string; completed: number; rollingAverage: number }[] }) {
  return (
    <ChartCard
      title="Sessões concluídas por semana"
      description="Barras: semana · linha: média móvel de 4 semanas"
      empty={!data.length}
      table={{
        headers: ["Semana (início)", "Concluídas", "Média 4 sem."],
        rows: data.map((d) => [formatDateBR(d.weekStart), d.completed, formatDecimal(d.rollingAverage)]),
      }}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="weekStart" tickFormatter={(d: string) => formatDateBR(d).slice(0, 5)} minTickGap={24} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            content={(p) => (
              <ChartTooltip active={p.active} payload={p.payload} label={p.label} labelFormatter={(l) => `Semana de ${formatDateBR(l)}`} />
            )}
          />
          <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
          <Bar dataKey="completed" name="Concluídas" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
          <Line
            dataKey="rollingAverage"
            name="Média móvel (4 sem.)"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            type="linear"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Ranking: one hue, identity by label (no legend needed). */
export function RankingBarChart({
  title,
  description,
  data,
  valueLabel,
  showShare = false,
}: {
  title: string;
  description?: string;
  data: { name: string; count: number; share?: number }[];
  valueLabel: string;
  showShare?: boolean;
}) {
  const height = Math.max(160, data.length * 30 + 20);
  return (
    <ChartCard
      title={title}
      description={description}
      empty={!data.some((d) => d.count)}
      height={height}
      table={{
        headers: showShare ? ["Nome", valueLabel, "Participação"] : ["Nome", valueLabel],
        rows: data.map((d) => (showShare ? [d.name, d.count, formatPercent(d.share ?? 0)] : [d.name, d.count])),
      }}
    >
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }} barCategoryGap="20%">
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={130} {...AXIS} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "var(--surface-hover)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} />} />
          <Bar
            dataKey="count"
            name={valueLabel}
            fill="var(--series-1)"
            radius={[0, 4, 4, 0]}
            label={{ position: "right", fill: "var(--text-2)", fontSize: 12, formatter: (v: unknown) => formatInteger(Number(v)) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CategoryByMonthChart({
  months,
  series,
}: {
  months: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  // At most 5 named series + "Outras", so the categorical palette stays legible.
  const top = series.slice(0, 5);
  const rest = series.slice(5);
  const keys = [...top.map((s) => s.name), ...(rest.length ? ["Outras"] : [])];
  const data = months.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    top.forEach((s) => (row[s.name] = s.values[i]));
    if (rest.length) row.Outras = rest.reduce((sum, s) => sum + s.values[i], 0);
    return row;
  });
  return (
    <ChartCard
      title="Categorias por mês"
      description="Sessões concluídas · 5 categorias mais frequentes"
      empty={!months.length}
      height={280}
      table={{
        headers: ["Mês", ...keys],
        rows: data.map((r) => [formatMonthShort(String(r.month)), ...keys.map((k) => Number(r[k] ?? 0))]),
      }}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="25%">
          {GRID}
          <XAxis dataKey="month" tickFormatter={formatMonthShort} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} labelFormatter={formatMonthShort} />}
          />
          <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={k}
              stackId="c"
              fill={k === "Outras" ? "var(--series-muted)" : SERIES[i]}
              stroke="var(--chart-surface)"
              strokeWidth={1}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CycleHistoryChart({ data }: { data: { cycleNumber: number; completed: number; pending: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: `Ciclo ${d.cycleNumber}` }));
  return (
    <ChartCard
      title="Histórico por ciclo de pagamento"
      empty={!data.length}
      table={{ headers: ["Ciclo", "Concluídas", "Pendentes"], rows: data.map((d) => [d.cycleNumber, d.completed, d.pending]) }}
    >
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
          {GRID}
          <XAxis dataKey="label" {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip cursor={{ fill: "var(--surface-hover)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} />} />
          <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
          <Bar dataKey="completed" name="Concluídas" stackId="a" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth={1} />
          <Bar dataKey="pending" name="Pendentes" stackId="a" fill="var(--series-muted)" stroke="var(--chart-surface)" strokeWidth={1} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
