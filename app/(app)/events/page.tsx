import { Flag } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { EventCard } from "@/components/events/event-card";
import { DataError, ListSkeleton } from "@/components/feedback/states";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { loadFormOptions } from "@/features/options";
import { load } from "@/lib/data/load";
import { listEvents } from "@/lib/db/repositories/events";
import { getSettings } from "@/lib/db/repositories/settings";

export const metadata: Metadata = { title: "Eventos" };

export default function EventsPage() {
  return (
    <>
      <PageHeader
        title="Eventos"
        description="Cirurgia, feriados, pausas, retornos e eventos personalizados. Eventos nunca viram sessões automaticamente."
      />
      <Suspense fallback={<ListSkeleton />}>
        <EventsContent />
      </Suspense>
    </>
  );
}

async function EventsContent() {
  const result = await load("events", async () => {
    const [events, settings, options] = await Promise.all([listEvents(), getSettings(), loadFormOptions()]);
    return { events, settings, options };
  });
  if (!result.ok) return <DataError message={result.error} />;
  const { events, settings, options } = result.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <QuickActions options={options} only={["event"]} />
      </div>
      <Card>
        {events.length ? (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id}>
                <EventCard event={e} isReference={e.id === settings.surgeryEventId} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Flag className="size-5" />} title="Nenhum evento cadastrado" />
        )}
      </Card>
      <p className="text-[13px] text-fg-3">Pagamentos e bônus são gerenciados em Ciclos e bônus.</p>
    </div>
  );
}
