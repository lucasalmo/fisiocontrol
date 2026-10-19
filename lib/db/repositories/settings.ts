import "server-only";
import { db, withTransaction, type Queryable } from "../client";
import type { AppSettings, MilestoneRow } from "@/types/domain";
import type { IsoDate } from "@/lib/dates/calendar";

type SettingsRow = {
  surgery_event_id: number | null;
  surgery_date: IsoDate | null;
  default_cycle_limit: number;
  default_extra_allowance: number;
  time_zone: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  surgeryEventId: null,
  surgeryDate: null,
  defaultCycleLimit: 40,
  defaultExtraAllowance: 3,
  timeZone: "America/Sao_Paulo",
};

export async function getSettings(tx: Queryable = db): Promise<AppSettings> {
  const { rows } = await tx.query<SettingsRow>(
    `SELECT s.surgery_event_id, e.event_date AS surgery_date, s.default_cycle_limit, s.default_extra_allowance, s.time_zone
       FROM app_settings s
       LEFT JOIN events e ON e.id = s.surgery_event_id
      WHERE s.id = 1`,
  );
  const r = rows[0];
  if (!r) return DEFAULT_SETTINGS;
  return {
    surgeryEventId: r.surgery_event_id,
    surgeryDate: r.surgery_date,
    defaultCycleLimit: r.default_cycle_limit,
    defaultExtraAllowance: r.default_extra_allowance,
    timeZone: r.time_zone,
  };
}

async function ensureSettingsRow(tx: Queryable) {
  await tx.query(`INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
}

/**
 * Changes the reference surgery date. Only the surgery event is touched; dates
 * of sessions and other events are never modified.
 */
export async function updateSurgeryDate(date: IsoDate): Promise<void> {
  await withTransaction(async (tx) => {
    await ensureSettingsRow(tx);
    const settings = await getSettings(tx);
    if (settings.surgeryEventId) {
      await tx.query(`UPDATE events SET event_date = $1 WHERE id = $2`, [date, settings.surgeryEventId]);
      return;
    }
    // Reuse an existing surgery event on that date, or create one.
    const existing = await tx.query<{ id: number }>(
      `SELECT id FROM events WHERE type = 'surgery' AND event_date = $1 ORDER BY id LIMIT 1`,
      [date],
    );
    const id =
      existing.rows[0]?.id ??
      (
        await tx.query<{ id: number }>(
          `INSERT INTO events (title, type, event_date) VALUES ('Cirurgia', 'surgery', $1) RETURNING id`,
          [date],
        )
      ).rows[0].id;
    await tx.query(`UPDATE app_settings SET surgery_event_id = $1 WHERE id = 1`, [id]);
  });
}

/** Makes an existing surgery event the reference for the counter. */
export async function setReferenceSurgeryEvent(eventId: number): Promise<void> {
  await withTransaction(async (tx) => {
    await ensureSettingsRow(tx);
    await tx.query(`UPDATE app_settings SET surgery_event_id = $1 WHERE id = 1`, [eventId]);
  });
}

export async function updateGeneralSettings(input: {
  defaultCycleLimit: number;
  defaultExtraAllowance: number;
  timeZone: string;
}) {
  // Applies to cycles created from now on; existing cycles keep their values.
  await withTransaction(async (tx) => {
    await ensureSettingsRow(tx);
    await tx.query(
      `UPDATE app_settings SET default_cycle_limit = $1, time_zone = $2, default_extra_allowance = $3 WHERE id = 1`,
      [input.defaultCycleLimit, input.timeZone, input.defaultExtraAllowance],
    );
  });
}

export async function listMilestones(tx: Queryable = db): Promise<MilestoneRow[]> {
  const { rows } = await tx.query<MilestoneRow>(`SELECT id, days, label FROM milestones ORDER BY days`);
  return rows;
}

export async function createMilestone(days: number, label: string | null) {
  await db.query(`INSERT INTO milestones (days, label) VALUES ($1, $2)`, [days, label]);
}

export async function deleteMilestone(id: number) {
  await db.query(`DELETE FROM milestones WHERE id = $1`, [id]);
}
