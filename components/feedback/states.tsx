import { DatabaseZap } from "lucide-react";
import { Card, Skeleton } from "@/components/ui/primitives";

export function DataError({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center" role="alert">
      <div className="rounded-xl border border-border bg-danger-soft p-2.5 text-danger-strong">
        <DatabaseZap className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium">Não foi possível carregar os dados</p>
      <p className="max-w-md text-[13px] text-fg-3">{message}</p>
    </Card>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-40" />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
