"use client";

import { CalendarPlus, CreditCard, Gift, Plus } from "lucide-react";
import { useState } from "react";
import type { FormOptions } from "@/types/options";
import { BonusForm } from "@/components/cycles/bonus-form";
import { PaymentForm } from "@/components/cycles/payment-form";
import { EventForm } from "@/components/events/event-form";
import { SessionForm } from "@/components/sessions/session-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";

export type QuickKind = "session" | "payment" | "event" | "bonus";

/** Shared dialogs for creating sessions, payments, bonuses and events. */
export function CreateDialogs({
  options,
  open,
  onClose,
  onSwitch,
  date,
}: {
  options: FormOptions;
  open: QuickKind | null;
  onClose: () => void;
  onSwitch: (kind: QuickKind) => void;
  date?: string;
}) {
  const day = date ?? options.today;
  return (
    <>
      <Dialog open={open === "session"} onClose={onClose} title="Nova sessão" size="lg">
        <SessionForm options={options} defaultDate={day} onDone={onClose} />
      </Dialog>
      <Dialog
        open={open === "payment"}
        onClose={onClose}
        title="Registrar pagamento"
        description="Abre um novo ciclo de sessões."
        size="lg"
      >
        <PaymentForm
          defaultLimit={options.defaultCycleLimit}
          defaultExtra={options.defaultExtraAllowance}
          today={day}
          onDone={onClose}
        />
      </Dialog>
      <Dialog open={open === "bonus"} onClose={onClose} title="Registrar sessões bônus" size="lg">
        {options.cycles.length ? (
          <BonusForm cycles={options.cycles} today={day} onDone={onClose} />
        ) : (
          <p className="text-sm text-fg-3">Registre um pagamento antes de conceder bônus.</p>
        )}
      </Dialog>
      <Dialog open={open === "event"} onClose={onClose} title="Adicionar evento" size="lg">
        <EventForm defaultDate={day} onDone={onClose} onChooseOther={(k) => onSwitch(k)} />
      </Dialog>
    </>
  );
}

export function QuickActions({ options, only }: { options: FormOptions; only?: QuickKind[] }) {
  const [open, setOpen] = useState<QuickKind | null>(null);
  const show = (k: QuickKind) => !only || only.includes(k);
  return (
    <>
      {show("session") ? (
        <Button variant="primary" onClick={() => setOpen("session")}>
          <Plus className="size-4" aria-hidden /> Nova sessão
        </Button>
      ) : null}
      {show("payment") ? (
        <Button onClick={() => setOpen("payment")}>
          <CreditCard className="size-4" aria-hidden /> Pagamento
        </Button>
      ) : null}
      {show("bonus") ? (
        <Button onClick={() => setOpen("bonus")}>
          <Gift className="size-4" aria-hidden /> Bônus
        </Button>
      ) : null}
      {show("event") ? (
        <Button onClick={() => setOpen("event")}>
          <CalendarPlus className="size-4" aria-hidden /> Evento
        </Button>
      ) : null}
      <CreateDialogs options={options} open={open} onClose={() => setOpen(null)} onSwitch={setOpen} />
    </>
  );
}
