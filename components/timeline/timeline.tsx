import { GitCommitVertical } from "lucide-react";
import { KIND_META, UNKNOWN_KIND } from "@/components/events/event-meta";
import { EmptyState } from "@/components/ui/primitives";
import { SessionTypeBadge } from "@/components/sessions/session-type-badge";
import { formatDateWithWeekday, formatMonthYear } from "@/lib/dates/format";
import { cn } from "@/lib/utils/text";
import type { TimelineItem } from "@/types/domain";

/** Chronological list of sessions and events, grouped by month. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <EmptyState icon={<GitCommitVertical className="size-5" />} title="Nada para mostrar" description="Ajuste os filtros ou cadastre registros." />;
  }
  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([month, monthItems]) => {
        const [y, m] = month.split("-").map(Number);
        return (
          <section key={month} aria-label={formatMonthYear(y, m)}>
            <h2 className="sticky top-14 z-10 mb-2 bg-bg/90 py-1 text-[13px] font-semibold tracking-wide text-fg-3 uppercase backdrop-blur lg:top-0">
              {formatMonthYear(y, m)}
            </h2>
            <ol className="relative ml-3 border-l border-border">
              {monthItems.map((item) => (
                <TimelineEntry key={item.key} item={item} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  const meta = KIND_META[item.kind] ?? UNKNOWN_KIND;
  const Icon = meta.icon;
  const major = item.kind === "surgery" || item.kind === "payment";
  return (
    <li className="relative pb-3 pl-6 last:pb-0">
      <span
        className={cn("absolute top-2 -left-[13px] grid size-6 place-items-center rounded-full border-2 border-bg", meta.chip)}
        aria-hidden
      >
        <Icon className="size-3" />
      </span>
      <div className={cn("rounded-lg px-3 py-2", major ? "border border-border bg-surface shadow-xs" : "hover:bg-surface")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] text-fg-3 tabular">{formatDateWithWeekday(item.date)}</span>
          <span className={cn("text-sm", major ? "font-semibold" : "font-medium")}>{item.title}</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", meta.chip)}>{meta.label}</span>
          {item.categoryName ? <SessionTypeBadge name={item.categoryName} color={item.categoryColor} /> : null}
        </div>
        {item.subtitle || item.description ? (
          <p className="mt-0.5 text-[13px] text-fg-3">
            {[item.subtitle, item.description].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
    </li>
  );
}
