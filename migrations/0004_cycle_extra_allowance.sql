-- Extra sessions allowed beyond the paid limit (default 3: a 40-session cycle
-- accepts sessions up to number 43). Balance and progress still use the paid
-- limit (base + bonuses); sessions above it are shown as "excedentes".
-- The allowance is stored per cycle so changing the default never alters
-- existing cycles retroactively.

ALTER TABLE payment_cycles
  ADD COLUMN extra_allowance INTEGER NOT NULL DEFAULT 3 CHECK (extra_allowance BETWEEN 0 AND 100);

ALTER TABLE app_settings
  ADD COLUMN default_extra_allowance INTEGER NOT NULL DEFAULT 3 CHECK (default_extra_allowance BETWEEN 0 AND 100);

-- Highest session number a cycle accepts.
CREATE OR REPLACE FUNCTION cycle_max_allowed(p_cycle_id BIGINT) RETURNS INTEGER AS $$
  SELECT c.base_limit + c.extra_allowance
         + COALESCE((SELECT SUM(b.quantity) FROM bonuses b WHERE b.cycle_id = c.id), 0)::INTEGER
    FROM payment_cycles c
   WHERE c.id = p_cycle_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION enforce_session_cycle_limit() RETURNS trigger AS $$
DECLARE
  max_allowed INTEGER := cycle_max_allowed(NEW.cycle_id);
BEGIN
  IF NEW.number_in_cycle > max_allowed THEN
    RAISE EXCEPTION 'Session number % exceeds cycle maximum %', NEW.number_in_cycle, max_allowed
      USING ERRCODE = 'check_violation', CONSTRAINT = 'sessions_within_cycle_limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assert_cycle_fits_sessions(p_cycle_id BIGINT) RETURNS void AS $$
DECLARE
  max_allowed INTEGER := cycle_max_allowed(p_cycle_id);
  highest     INTEGER;
BEGIN
  SELECT MAX(number_in_cycle) INTO highest FROM sessions WHERE cycle_id = p_cycle_id;
  IF max_allowed IS NOT NULL AND highest IS NOT NULL AND highest > max_allowed THEN
    RAISE EXCEPTION 'Cycle % would have maximum % below session number %', p_cycle_id, max_allowed, highest
      USING ERRCODE = 'check_violation', CONSTRAINT = 'cycle_limit_below_sessions';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Re-check when either the base limit or the allowance is lowered.
DROP TRIGGER payment_cycles_limit_fits_sessions ON payment_cycles;
CREATE TRIGGER payment_cycles_limit_fits_sessions
  AFTER UPDATE OF base_limit, extra_allowance ON payment_cycles
  FOR EACH ROW EXECUTE FUNCTION check_cycle_limit_after_change();

-- New columns are appended at the end so CREATE OR REPLACE VIEW is allowed.
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
  COALESCE(b.bonus_total, 0)::INTEGER                                   AS bonus_total,
  (c.base_limit + COALESCE(b.bonus_total, 0))::INTEGER                  AS total_limit,
  COALESCE(s.completed_count, 0)::INTEGER                               AS completed_count,
  COALESCE(s.pending_count, 0)::INTEGER                                 AS pending_count,
  COALESCE(s.max_number, 0)::INTEGER                                    AS max_number,
  s.first_session_date,
  s.last_session_date,
  COALESCE(s.max_completed_number, 0)::INTEGER                          AS max_completed_number,
  c.extra_allowance,
  (c.base_limit + COALESCE(b.bonus_total, 0) + c.extra_allowance)::INTEGER AS max_allowed
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
