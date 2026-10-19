/** Lightweight shapes passed from Server to Client Components for forms. */

export type CycleOption = {
  id: number;
  cycleNumber: number;
  totalLimit: number;
  /** Highest number accepted (paid limit + extras). */
  maxAllowed: number;
  maxNumber: number;
  registered: number;
};

export type CategoryOption = {
  id: number;
  name: string;
  color: string;
  active: boolean;
};

export type FormOptions = {
  cycles: CycleOption[];
  categories: CategoryOption[];
  defaultCycleLimit: number;
  defaultExtraAllowance: number;
  today: string;
};
