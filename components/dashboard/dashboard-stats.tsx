import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/primitives";

export type StatTile = {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
};

export function DashboardStats({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map(({ label, value, detail, icon: Icon }) => (
        <Card key={label} className="flex flex-col gap-1 p-4">
          <p className="flex items-center gap-1.5 text-[13px] text-fg-3">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </p>
          <p className="truncate text-xl font-semibold tracking-tight text-fg tabular">{value}</p>
          {detail ? <p className="truncate text-xs text-fg-3">{detail}</p> : null}
        </Card>
      ))}
    </div>
  );
}
