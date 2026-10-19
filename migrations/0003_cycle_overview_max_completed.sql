-- Adds the highest completed session number to cycle_overview.
-- Needed when a cycle was imported from a partial history (e.g. sessions
-- 35–41 only): slots are positional, so numbers below the highest one are
-- considered used even if they were never registered.

CREATE OR REPLACE VIEW cycle_overview AS
SELECT
  c.id,
  c.cycle_number,
  c.payment_date,
  c.start_date,
  c.base_limit,
  c.notes,
  c.created_at,
  c.updated_at,
  COALESCE(b.bonus_total, 0)::INTEGER                       AS bonus_total,
  (c.base_limit + COALESCE(b.bonus_total, 0))::INTEGER      AS total_limit,
  COALESCE(s.completed_count, 0)::INTEGER                   AS completed_count,
  COALESCE(s.pending_count, 0)::INTEGER                     AS pending_count,
  COALESCE(s.max_number, 0)::INTEGER                        AS max_number,
  s.first_session_date,
  s.last_session_date,
  COALESCE(s.max_completed_number, 0)::INTEGER              AS max_completed_number
FROM payment_cycles c
LEFT JOIN (
  SELECT cycle_id, SUM(quantity) AS bonus_total FROM bonuses GROUP BY cycle_id
) b ON b.cycle_id = c.id
LEFT JOIN (
  SELECT cycle_id,
         COUNT(*) FILTER (WHERE status = 'completed')                 AS completed_count,
         COUNT(*) FILTER (WHERE status = 'pending')                   AS pending_count,
         MAX(number_in_cycle)                                         AS max_number,
         MIN(session_date)                                            AS first_session_date,
         MAX(session_date)                                            AS last_session_date,
         MAX(number_in_cycle) FILTER (WHERE status = 'completed')     AS max_completed_number
    FROM sessions GROUP BY cycle_id
) s ON s.cycle_id = c.id;
