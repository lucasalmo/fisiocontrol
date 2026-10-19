import "server-only";
import { db } from "../client";
import type { StatSession } from "@/features/statistics/compute";

export async function getSessionTotals() {
  const { rows } = await db.query<{ completed: number; pending: number }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending
       FROM sessions`,
  );
  return rows[0];
}

export async function listStatSessions(): Promise<StatSession[]> {
  const { rows } = await db.query<{
    date: string;
    status: "pending" | "completed";
    category_name: string | null;
    category_color: string | null;
    cycle_number: number;
  }>(
    `SELECT s.session_date AS date, s.status, cat.name AS category_name, cat.color AS category_color, c.cycle_number
       FROM sessions s
       JOIN payment_cycles c ON c.id = s.cycle_id
       LEFT JOIN session_categories cat ON cat.id = s.category_id
      ORDER BY s.session_date`,
  );
  return rows.map((r) => ({
    date: r.date,
    status: r.status,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    cycleNumber: r.cycle_number,
  }));
}

export async function listUpcomingEvents(today: string, limit: number) {
  const { rows } = await db.query<{ key: string; kind: string; date: string; title: string }>(
    `SELECT * FROM (
       SELECT 'e' || id AS key, type AS kind, event_date AS date, title FROM events WHERE event_date >= $1
       UNION ALL
       SELECT 'p' || id, 'payment', payment_date, 'Pagamento — ciclo ' || cycle_number
         FROM payment_cycles WHERE payment_date >= $1
     ) t ORDER BY date LIMIT $2`,
    [today, limit],
  );
  return rows;
}
