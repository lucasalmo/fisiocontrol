"use client";

import type { ReactNode } from "react";
import { Dialog } from "./dialog";
import { Button } from "./primitives";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  pending,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="text-sm text-fg-2">{description}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={pending} autoFocus>
          {pending ? "Aguarde…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
