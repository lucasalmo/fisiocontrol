import type { IsoDate } from "@/lib/dates/calendar";

export type SessionStatus = "pending" | "completed";

export type Category = {
  id: number;
  name: string;
  normalizedName: string;
  color: string;
  active: boolean;
  usageCount: number;
  lastUsedOn: IsoDate | null;
};

export type Session = {
  id: number;
  cycleId: number;
  cycleNumber: number;
  numberInCycle: number;
  globalNumber: number | null;
  sessionDate: IsoDate;
  status: SessionStatus;
  completedAt: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Cycle = {
  id: number;
  cycleNumber: number;
  paymentDate: IsoDate | null;
  startDate: IsoDate | null;
  baseLimit: number;
  bonusTotal: number;
  totalLimit: number;
  completedCount: number;
  pendingCount: number;
  /** Highest session number registered in the cycle. */
  maxNumber: number;
  /** Highest completed session number in the cycle. */
  maxCompletedNumber: number;
  firstSessionDate: IsoDate | null;
  lastSessionDate: IsoDate | null;
  notes: string | null;
  createdAt: string;
};

export type Bonus = {
  id: number;
  cycleId: number;
  cycleNumber: number;
  quantity: number;
  grantedOn: IsoDate;
  reason: string;
  notes: string | null;
  createdAt: string;
};

export const EVENT_TYPES = ["surgery", "holiday", "pause", "resume", "custom"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type TreatmentEvent = {
  id: number;
  title: string;
  type: EventType;
  eventDate: IsoDate;
  description: string | null;
  createdAt: string;
};

export type MilestoneRow = { id: number; days: number; label: string | null };

export type AppSettings = {
  surgeryEventId: number | null;
  surgeryDate: IsoDate | null;
  defaultCycleLimit: number;
  timeZone: string;
};

/** Everything that can appear on the timeline / calendar. */
export type TimelineKind =
  | "session-completed"
  | "session-pending"
  | "surgery"
  | "payment"
  | "bonus"
  | "holiday"
  | "pause"
  | "resume"
  | "custom";

export type TimelineItem = {
  key: string;
  kind: TimelineKind;
  date: IsoDate;
  title: string;
  subtitle: string | null;
  description: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  /** Record id in its own table, used for edit links. */
  refId: number;
  cycleNumber: number | null;
};
