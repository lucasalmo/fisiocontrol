import "server-only";
import { db, withTransaction, type Queryable } from "../client";
import { UserFacingError } from "../errors";
import type { EventType, TimelineItem, TimelineKind, TreatmentEvent } from "@/types/domain";
import type { EventInput } from "@/lib/validation/schemas";

type EventRow = {
  id: number;
  title: string;
  type: EventType;
  event_date: string;
  description: string | null;
  created_at: string;
};

function map(r: EventRow): TreatmentEvent {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    eventDate: r.event_date,
    description: r.description,
    createdAt: r.created_at,
  };
}

export async function listEvents(filters: { type?: EventType; from?: string; to?: string } = {}) {
  const { rows } = await db.query<EventRow>(
    `SELECT id, title, type, event_date, description, created_at FROM events
      WHERE ($1::text IS NULL OR type = $1)
        AND ($2::date IS NULL OR event_date >= $2)
        AND ($3::date IS NULL OR event_date <= $3)
      ORDER BY event_date DESC, id DESC`,
    [filters.type ?? null, filters.from ?? null, filters.to ?? null],
  );
  return rows.map(map);
}

export async function getEvent(id: number): Promise<TreatmentEvent | null> {
  const { rows } = await db.query<EventRow>(
    `SELECT id, title, type, event_date, description, created_at FROM events WHERE id = $1`,
    [id],
  );
  return rows[0] ? map(rows[0]) : null;
}

export async function createEvent(input: EventInput, tx: Queryable = db, importKey: string | null = null) {
  const { rows } = await tx.query<{ id: number }>(
    `INSERT INTO events (title, type, event_date, description, import_key) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.title, input.type, input.eventDate, input.description ?? null, importKey],
  );
  const id = rows[0].id;
  // The first surgery registered becomes the counter's reference automatically.
  if (input.type === "surgery") {
    await tx.query(
      `INSERT INTO app_settings (id, surgery_event_id) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET surgery_event_id = COALESCE(app_settings.surgery_event_id, EXCLUDED.surgery_event_id)`,
      [id],
    );
  }
  return id;
}

export async function createEventTx(input: EventInput) {
  return withTransaction((tx) => createEvent(input, tx));
}

/** Editing the reference surgery event also moves the counter's date. */
export async function updateEvent(id: number, input: EventInput) {
  const { rowCount } = await db.query(
    `UPDATE events SET title = $2, type = $3, event_date = $4, description = $5 WHERE id = $1`,
    [id, input.title, input.type, input.eventDate, input.description ?? null],
  );
  if (!rowCount) throw new UserFacingError("Evento não encontrado.");
}

export async function deleteEvent(id: number) {
  const { rowCount } = await db.query(`DELETE FROM events WHERE id = $1`, [id]);
  if (!rowCount) throw new UserFacingError("Evento não encontrado.");
}

// ---------------------------------------------------------------------------
// Timeline: sessions + events + payments + bonuses in one chronological list.
// ---------------------------------------------------------------------------

type TimelineRow = {
  key: string;
  kind: TimelineKind;
  date: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category_name: string | null;
  category_color: string | null;
  ref_id: number;
  cycle_number: number | null;
};

export async function listTimeline(
  filters: { kinds?: TimelineKind[]; from?: string; to?: string; order?: "asc" | "desc"; limit?: number } = {},
): Promise<TimelineItem[]> {
  const { rows } = await db.query<TimelineRow>(
    `SELECT * FROM (
       SELECT 's' || s.id AS key,
              CASE WHEN s.status = 'completed' THEN 'session-completed' ELSE 'session-pending' END AS kind,
              s.session_date AS date,
              'Sessão ' || s.number_in_cycle AS title,
              'Ciclo ' || c.cycle_number || COALESCE(' · nº global ' || s.global_number, '') AS subtitle,
              s.notes AS description, cat.name AS category_name, cat.color AS category_color,
              s.id AS ref_id, c.cycle_number
         FROM sessions s
         JOIN payment_cycles c ON c.id = s.cycle_id
         LEFT JOIN session_categories cat ON cat.id = s.category_id
       UNION ALL
       SELECT 'e' || e.id, e.type, e.event_date, e.title, NULL, e.description, NULL, NULL, e.id, NULL
         FROM events e
       UNION ALL
       SELECT 'p' || c.id, 'payment', c.payment_date,
              'Pagamento — ciclo ' || c.cycle_number,
              c.base_limit || ' sessões liberadas', c.notes, NULL, NULL, c.id, c.cycle_number
         FROM payment_cycles c WHERE c.payment_date IS NOT NULL
       UNION ALL
       SELECT 'b' || b.id, 'bonus', b.granted_on,
              '+' || b.quantity || CASE WHEN b.quantity = 1 THEN ' sessão bônus' ELSE ' sessões bônus' END,
              'Ciclo ' || c.cycle_number || ' · ' || b.reason, b.notes, NULL, NULL, b.id, c.cycle_number
         FROM bonuses b JOIN payment_cycles c ON c.id = b.cycle_id
     ) t
     WHERE ($1::text[] IS NULL OR t.kind = ANY($1))
       AND ($2::date IS NULL OR t.date >= $2)
       AND ($3::date IS NULL OR t.date <= $3)
     ORDER BY t.date ${filters.order === "asc" ? "ASC" : "DESC"},
              CASE t.kind WHEN 'surgery' THEN 0 WHEN 'payment' THEN 1 WHEN 'bonus' THEN 2 ELSE 3 END,
              t.cycle_number NULLS FIRST, t.ref_id
     LIMIT $4`,
    [filters.kinds?.length ? filters.kinds : null, filters.from ?? null, filters.to ?? null, filters.limit ?? 2000],
  );
  return rows.map((r) => ({
    key: r.key,
    kind: r.kind,
    date: r.date,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    refId: r.ref_id,
    cycleNumber: r.cycle_number,
  }));
}
