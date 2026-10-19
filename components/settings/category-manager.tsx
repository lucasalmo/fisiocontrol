"use client";

import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteCategoryAction, saveCategoryAction, setCategoryActiveAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateBR } from "@/lib/dates/format";
import type { Category } from "@/types/domain";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Badge, Button, Field, Input } from "@/components/ui/primitives";

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const { pending, run } = useAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      action={(fd) => run(() => saveCategoryAction(fd), { onSuccess: onDone, onError: (r) => setErrors(r.fieldErrors ?? { name: r.error }) })}
      className="flex flex-col gap-4"
    >
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <Field label="Nome" htmlFor="cat-name" error={errors.name}>
        <Input id="cat-name" name="name" defaultValue={category?.name} required maxLength={60} autoFocus />
      </Field>
      <Field label="Cor" htmlFor="cat-color" error={errors.color}>
        <Input id="cat-color" name="color" type="color" defaultValue={category?.color ?? "#64748b"} className="h-10 w-20 p-1" />
      </Field>
      {category?.usageCount ? (
        <p className="text-[13px] text-fg-3">Renomear atualiza o nome exibido nas {category.usageCount} sessões associadas.</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {category ? "Salvar" : "Criar categoria"}
        </Button>
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> Nova categoria
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={c.active ? "" : "text-fg-3 line-through"}>{c.name}</span>
                {!c.active ? <Badge>Desativada</Badge> : null}
              </p>
              <p className="text-xs text-fg-3">
                {c.usageCount} {c.usageCount === 1 ? "sessão" : "sessões"}
                {c.lastUsedOn ? ` · última em ${formatDateBR(c.lastUsedOn)}` : ""}
              </p>
            </div>
            <div className="flex gap-0.5">
              <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-fg-3 hover:bg-surface-hover hover:text-fg" aria-label={`Editar ${c.name}`}>
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => run(() => setCategoryActiveAction(c.id, !c.active))}
                disabled={pending}
                className="rounded-md p-1.5 text-fg-3 hover:bg-surface-hover hover:text-fg"
                aria-label={c.active ? `Desativar ${c.name}` : `Reativar ${c.name}`}
                title={c.active ? "Desativar" : "Reativar"}
              >
                {c.active ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
              </button>
              {c.usageCount === 0 ? (
                <button
                  onClick={() => setDeleting(c)}
                  className="rounded-md p-1.5 text-fg-3 hover:bg-danger-soft hover:text-danger-strong"
                  aria-label={`Excluir ${c.name}`}
                  title="Excluir (sem uso)"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-3">Categorias usadas por sessões não podem ser excluídas — desative-as para ocultá-las dos formulários.</p>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Nova categoria" : "Editar categoria"}>
        {editing ? <CategoryForm category={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Excluir categoria?"
        description={`“${deleting?.name}” não é usada por nenhuma sessão e será removida.`}
        confirmLabel="Excluir"
        pending={pending}
        onConfirm={() => deleting && run(() => deleteCategoryAction(deleting.id), { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
