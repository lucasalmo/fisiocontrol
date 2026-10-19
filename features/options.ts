import "server-only";
import { listCategories } from "@/lib/db/repositories/categories";
import { listCycles } from "@/lib/db/repositories/cycles";
import { getSettings } from "@/lib/db/repositories/settings";
import { todayIso } from "@/lib/dates/calendar";
import type { FormOptions } from "@/types/options";

/** Data every create/edit form needs (cycles, categories, today). */
export async function loadFormOptions(): Promise<FormOptions> {
  const [cycles, categories, settings] = await Promise.all([listCycles(), listCategories(), getSettings()]);
  return {
    cycles: cycles.map((c) => ({
      id: c.id,
      cycleNumber: c.cycleNumber,
      totalLimit: c.totalLimit,
      maxNumber: c.maxNumber,
      registered: Math.max(c.completedCount + c.pendingCount, c.maxNumber),
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, color: c.color, active: c.active })),
    defaultCycleLimit: settings.defaultCycleLimit,
    today: todayIso(settings.timeZone),
  };
}
