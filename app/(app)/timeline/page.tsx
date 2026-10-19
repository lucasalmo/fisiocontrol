import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KIND_META } from "@/components/events/event-meta";
import { DataError, ListSkeleton } from "@/components/feedback/states";
import { Timeline } from "@/components/timeline/timeline";
import { Button, Card, Input, PageHeader, Select, buttonClass } from "@/components/ui/primitives";
import { load } from "@/lib/data/load";
import { isIsoDate } from "@/lib/dates/calendar";
import { listTimeline } from "@/lib/db/repositories/events";
import type { TimelineKind } from "@/types/domain";

export const metadata: Metadata = { title: "Linha do tempo" };

const KINDS = Object.keys(KIND_META) as TimelineKind[];

export default function TimelinePage(props: PageProps<"/timeline">) {
  return (
    <>
      <PageHeader title="Linha do tempo" description="Sessões, cirurgia, pagamentos, bônus e eventos em ordem cronológica." />
      <Suspense fallback={<ListSkeleton rows={10} />}>
        <TimelineContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function TimelineContent({ searchParams }: { searchParams: PageProps<"/timeline">["searchParams"] }) {
  const sp = await searchParams;
  const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
  const kinds = list(sp.kind).filter((k): k is TimelineKind => KINDS.includes(k as TimelineKind));
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const from = isIsoDate(one(sp.from)) ? one(sp.from) : undefined;
  const to = isIsoDate(one(sp.to)) ? one(sp.to) : undefined;
  const order = one(sp.order) === "desc" ? "desc" : "asc";

  const result = await load("timeline", () => listTimeline({ kinds, from, to, order }));
  if (!result.ok) return <DataError message={result.error} />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-3 sm:p-4">
        <form method="get" className="flex flex-col gap-3" aria-label="Filtrar linha do tempo">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-fg-2">Tipos</legend>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                return (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[13px] text-fg-2 has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent-text"
                  >
                    <input type="checkbox" name="kind" value={k} defaultChecked={kinds.includes(k)} className="sr-only" />
                    <Icon className="size-3.5" aria-hidden />
                    {meta.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[13px] text-fg-2">
              De
              <Input type="date" name="from" defaultValue={from} className="w-auto" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-fg-2">
              Até
              <Input type="date" name="to" defaultValue={to} className="w-auto" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-fg-2">
              Ordem
              <Select name="order" defaultValue={order} className="w-auto">
                <option value="asc">Mais antigos primeiro</option>
                <option value="desc">Mais recentes primeiro</option>
              </Select>
            </label>
            <Button type="submit">Filtrar</Button>
            <Link href="/timeline" className={buttonClass("ghost")}>
              Limpar
            </Link>
          </div>
        </form>
      </Card>
      <p className="text-[13px] text-fg-3" aria-live="polite">
        {result.data.length} {result.data.length === 1 ? "registro" : "registros"}
        {kinds.length ? "" : " · selecione tipos para filtrar (nenhum selecionado = todos)"}
      </p>
      <Timeline items={result.data} />
    </div>
  );
}
