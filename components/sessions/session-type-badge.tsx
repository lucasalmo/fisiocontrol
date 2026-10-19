export function SessionTypeBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return <span className="text-xs text-fg-3">Sem categoria</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-fg-2">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? "#94a3b8" }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
