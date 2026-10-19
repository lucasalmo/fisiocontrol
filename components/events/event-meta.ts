import {
  Ban,
  CalendarHeart,
  CheckCircle2,
  Circle,
  CreditCard,
  Gift,
  HeartPulse,
  Pause,
  Play,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { EventType, TimelineKind } from "@/types/domain";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  surgery: "Cirurgia",
  holiday: "Feriado",
  pause: "Pausa no tratamento",
  resume: "Retorno ao tratamento",
  custom: "Evento personalizado",
};

/** Visual identity of each timeline/calendar kind (icon + label, never color alone). */
export const KIND_META: Record<TimelineKind, { label: string; icon: LucideIcon; dot: string; chip: string }> = {
  "session-completed": {
    label: "Sessão concluída",
    icon: CheckCircle2,
    dot: "bg-success",
    chip: "bg-success-soft text-success",
  },
  "session-pending": {
    label: "Sessão pendente",
    icon: Circle,
    dot: "bg-surface ring-2 ring-inset ring-border-strong",
    chip: "bg-surface-2 text-fg-2",
  },
  surgery: { label: "Cirurgia", icon: HeartPulse, dot: "bg-danger-strong", chip: "bg-danger-soft text-danger-strong" },
  payment: { label: "Pagamento", icon: CreditCard, dot: "bg-info", chip: "bg-info-soft text-info" },
  bonus: { label: "Bônus", icon: Gift, dot: "bg-accent", chip: "bg-accent-soft text-accent-text" },
  holiday: { label: "Feriado", icon: CalendarHeart, dot: "bg-warning", chip: "bg-warning-soft text-warning" },
  pause: { label: "Pausa", icon: Pause, dot: "bg-fg-3", chip: "bg-surface-2 text-fg-2" },
  resume: { label: "Retorno", icon: Play, dot: "bg-accent", chip: "bg-accent-soft text-accent-text" },
  custom: { label: "Evento", icon: Sparkles, dot: "bg-fg-2", chip: "bg-surface-2 text-fg-2" },
};

export const UNKNOWN_KIND = { label: "Outro", icon: Ban, dot: "bg-fg-3", chip: "bg-surface-2 text-fg-2" };
