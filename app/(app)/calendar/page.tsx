import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { DataError, PageSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/ui/primitives";
import { loadFormOptions } from "@/features/options";
import { load } from "@/lib/data/load";
import { monthGrid } from "@/lib/dates/calendar";
import { listTimeline } from "@/lib/db/repositories/events";

export const metadata: Metadata = { title: "Calendário" };

export default function CalendarPage(props: PageProps<"/calendar">) {
  return (
    <>
      <PageHeader title="Calendário" description="Sessões e eventos por mês. Selecione um dia para ver os registros." />
      <Suspense fallback={<PageSkeleton rows={1} />}>
        <CalendarContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CalendarContent({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const m = (await searchParams).m;
  const result = await load("calendar", async () => {
    const options = await loadFormOptions();
    const match = /^(\d{4})-(\d{2})$/.exec(typeof m === "string" ? m : "");
    let year = Number(options.today.slice(0, 4));
    let month = Number(options.today.slice(5, 7));
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) {
      year = Number(match[1]);
      month = Number(match[2]);
    }
    const grid = monthGrid(year, month);
    const items = await listTimeline({ from: grid[0], to: grid[grid.length - 1], order: "asc" });
    return { options, year, month, grid, items };
  });
  if (!result.ok) return <DataError message={result.error} />;
  const { options, year, month, grid, items } = result.data;
  return <CalendarView key={`${year}-${month}`} year={year} month={month} grid={grid} items={items} options={options} />;
}
