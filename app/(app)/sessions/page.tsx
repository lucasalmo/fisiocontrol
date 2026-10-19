import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DataError, ListSkeleton } from "@/components/feedback/states";
import { SessionFilters } from "@/components/sessions/session-filters";
import { SessionList } from "@/components/sessions/session-list";
import { Card, PageHeader, buttonClass } from "@/components/ui/primitives";
import { loadFormOptions } from "@/features/options";
import { load } from "@/lib/data/load";
import { formatInteger } from "@/lib/dates/format";
import { SESSIONS_PAGE_SIZE, listSessions } from "@/lib/db/repositories/sessions";
import { sessionFiltersSchema, type SessionFilters as Filters } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Sessões" };

export default function SessionsPage(props: PageProps<"/sessions">) {
  return (
    <>
      <PageHeader title="Sessões" description="Cadastre, conclua e pesquise suas sessões." />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <SessionsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function toQuery(filters: Filters, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && k !== "page") params.set(k, String(v));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function SessionsContent({ searchParams }: { searchParams: PageProps<"/sessions">["searchParams"] }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = sessionFiltersSchema.safeParse(flat);
  const filters: Filters = parsed.success ? parsed.data : {};

  const result = await load("sessions", async () => {
    const [list, options] = await Promise.all([listSessions(filters), loadFormOptions()]);
    return { list, options };
  });
  if (!result.ok) return <DataError message={result.error} />;
  const { list, options } = result.data;
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(list.total / SESSIONS_PAGE_SIZE));
  const exportQuery = toQuery(filters, 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <QuickActions options={options} only={["session"]} />
        <a href={`/api/export/sessions${exportQuery}`} className={buttonClass("secondary")} download>
          <Download className="size-4" aria-hidden /> Exportar CSV
        </a>
      </div>
      {!parsed.success ? <p className="text-sm text-danger-strong">Alguns filtros eram inválidos e foram ignorados.</p> : null}
      <SessionFilters filters={filters} cycles={options.cycles} categories={options.categories} />
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[13px] text-fg-3">
          <span aria-live="polite">
            {formatInteger(list.total)} {list.total === 1 ? "sessão encontrada" : "sessões encontradas"}
          </span>
          {pages > 1 ? (
            <span>
              Página {page} de {pages}
            </span>
          ) : null}
        </div>
        <SessionList
          sessions={list.items}
          options={options}
          emptyDescription={
            list.total === 0 && Object.keys(filters).length === 0
              ? "Cadastre sua primeira sessão ou importe o histórico em texto."
              : "Ajuste os filtros para ver outras sessões."
          }
        />
        {pages > 1 ? (
          <nav aria-label="Paginação" className="flex justify-between border-t border-border px-4 py-2.5">
            {page > 1 ? (
              <Link href={`/sessions${toQuery(filters, page - 1)}`} className={buttonClass("ghost", "sm")}>
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {page < pages ? (
              <Link href={`/sessions${toQuery(filters, page + 1)}`} className={buttonClass("ghost", "sm")}>
                Próxima →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Card>
    </div>
  );
}
