import { Search, X } from "lucide-react";
import Link from "next/link";
import type { SessionFilters as Filters } from "@/lib/validation/schemas";
import type { CategoryOption, CycleOption } from "@/types/options";
import { Button, Input, Select, buttonClass } from "@/components/ui/primitives";

/** Plain GET form: filters live in the URL (shareable, works without JS). */
export function SessionFilters({
  filters,
  cycles,
  categories,
}: {
  filters: Filters;
  cycles: CycleOption[];
  categories: CategoryOption[];
}) {
  const active = Object.entries(filters).some(([k, v]) => k !== "page" && k !== "sort" && v !== undefined);
  return (
    <form method="get" className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8" role="search" aria-label="Filtrar sessões">
      <div className="relative col-span-2 md:col-span-4 lg:col-span-2">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-fg-3" aria-hidden />
        <label htmlFor="q" className="sr-only">
          Pesquisar
        </label>
        <Input id="q" name="q" defaultValue={filters.q} placeholder="Pesquisar observações, categoria, nº…" className="pl-8" />
      </div>
      <label className="sr-only" htmlFor="f-status">
        Status
      </label>
      <Select id="f-status" name="status" defaultValue={filters.status ?? ""}>
        <option value="">Todos os status</option>
        <option value="completed">Concluídas</option>
        <option value="pending">Pendentes</option>
      </Select>
      <label className="sr-only" htmlFor="f-category">
        Categoria
      </label>
      <Select id="f-category" name="category" defaultValue={filters.category ?? ""}>
        <option value="">Todas as categorias</option>
        <option value="none">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.active ? "" : " (desativada)"}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="f-cycle">
        Ciclo
      </label>
      <Select id="f-cycle" name="cycle" defaultValue={filters.cycle ?? ""}>
        <option value="">Todos os ciclos</option>
        {[...cycles].reverse().map((c) => (
          <option key={c.id} value={c.id}>
            Ciclo {c.cycleNumber}
          </option>
        ))}
      </Select>
      <div className="flex flex-col">
        <label className="sr-only" htmlFor="f-from">
          De
        </label>
        <Input id="f-from" name="from" type="date" defaultValue={filters.from} title="Data inicial" />
      </div>
      <div className="flex flex-col">
        <label className="sr-only" htmlFor="f-to">
          Até
        </label>
        <Input id="f-to" name="to" type="date" defaultValue={filters.to} title="Data final" />
      </div>
      <div className="col-span-2 flex gap-2 md:col-span-4 lg:col-span-8">
        <label className="sr-only" htmlFor="f-sort">
          Ordenação
        </label>
        <Select id="f-sort" name="sort" defaultValue={filters.sort ?? "desc"} className="w-auto">
          <option value="desc">Mais recentes primeiro</option>
          <option value="asc">Mais antigas primeiro</option>
        </Select>
        <Button type="submit" variant="secondary">
          Aplicar filtros
        </Button>
        {active ? (
          <Link href="/sessions" className={buttonClass("ghost")}>
            <X className="size-4" aria-hidden /> Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
