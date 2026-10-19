import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CycleCard } from "@/components/cycles/cycle-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DataError, ListSkeleton } from "@/components/feedback/states";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { loadFormOptions } from "@/features/options";
import { load } from "@/lib/data/load";
import { listBonuses, listCycles } from "@/lib/db/repositories/cycles";

export const metadata: Metadata = { title: "Ciclos e bônus" };

export default function CyclesPage() {
  return (
    <>
      <PageHeader
        title="Ciclos e bônus"
        description="Cada pagamento abre um novo ciclo. Ciclos anteriores são preservados sem alterações."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <CyclesContent />
      </Suspense>
    </>
  );
}

async function CyclesContent() {
  const result = await load("cycles", async () => {
    const [cycles, bonuses, options] = await Promise.all([listCycles(), listBonuses(), loadFormOptions()]);
    return { cycles, bonuses, options };
  });
  if (!result.ok) return <DataError message={result.error} />;
  const { cycles, bonuses, options } = result.data;
  const current = cycles.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <QuickActions options={options} only={["payment", "bonus"]} />
      </div>
      {cycles.length ? (
        [...cycles].reverse().map((c) => (
          <CycleCard
            key={c.id}
            cycle={c}
            bonuses={bonuses.filter((b) => b.cycleId === c.id)}
            options={options}
            isCurrent={c.id === current?.id}
          />
        ))
      ) : (
        <Card>
          <EmptyState
            icon={<CreditCard className="size-5" />}
            title="Nenhum ciclo ainda"
            description="Registre um pagamento para abrir o primeiro ciclo (40 sessões por padrão) ou importe seu histórico."
          />
        </Card>
      )}
    </div>
  );
}
