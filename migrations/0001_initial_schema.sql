-- FisioControl — initial schema.
-- Calendar dates use DATE; real instants use TIMESTAMPTZ.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Training categories
-- ---------------------------------------------------------------------------
CREATE TABLE session_categories (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  -- Lower-case, accent-free, single-spaced name (computed by the app) used for
  -- uniqueness and for matching imported text.
  normalized_name TEXT NOT NULL UNIQUE CHECK (length(normalized_name) > 0),
  color           TEXT NOT NULL DEFAULT '#64748b' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER session_categories_updated_at BEFORE UPDATE ON session_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Payment cycles. Each payment opens a new cycle; old cycles are never
-- renumbered. The total limit is base_limit + SUM(bonuses.quantity) and is
-- computed by the cycle_overview view, so a bonus can never be added twice.
-- ---------------------------------------------------------------------------
CREATE TABLE payment_cycles (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_number  INTEGER NOT NULL UNIQUE CHECK (cycle_number > 0),
  payment_date  DATE,
  start_date    DATE,
  base_limit    INTEGER NOT NULL DEFAULT 40 CHECK (base_limit BETWEEN 1 AND 1000),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_cycles_payment_date_idx ON payment_cycles (payment_date);
CREATE TRIGGER payment_cycles_updated_at BEFORE UPDATE ON payment_cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Bonus sessions granted inside a cycle.
-- ---------------------------------------------------------------------------
CREATE TABLE bonuses (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_id    BIGINT NOT NULL REFERENCES payment_cycles (id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  granted_on  DATE NOT NULL,
  reason      TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  notes       TEXT,
  import_key  TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bonuses_cycle_idx ON bonuses (cycle_id);
CREATE INDEX bonuses_granted_on_idx ON bonuses (granted_on);
CREATE TRIGGER bonuses_updated_at BEFORE UPDATE ON bonuses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Treatment sessions.
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_id         BIGINT NOT NULL REFERENCES payment_cycles (id) ON DELETE RESTRICT,
  number_in_cycle  INTEGER NOT NULL CHECK (number_in_cycle > 0),
  global_number    INTEGER UNIQUE CHECK (global_number > 0),
  session_date     DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at     TIMESTAMPTZ,
  category_id      BIGINT REFERENCES session_categories (id) ON DELETE RESTRICT,
  notes            TEXT,
  import_key       TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sessions_unique_number_in_cycle UNIQUE (cycle_id, number_in_cycle),
  CONSTRAINT sessions_completed_at_matches_status
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX sessions_date_idx ON sessions (session_date);
CREATE INDEX sessions_status_date_idx ON sessions (status, session_date);
CREATE INDEX sessions_category_idx ON sessions (category_id);
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A session number can never exceed the cycle's total limit (base + bonuses).
CREATE OR REPLACE FUNCTION enforce_session_cycle_limit() RETURNS trigger AS $$
DECLARE
  total_limit INTEGER;
BEGIN
  SELECT c.base_limit + COALESCE((SELECT SUM(b.quantity) FROM bonuses b WHERE b.cycle_id = c.id), 0)
    INTO total_limit
    FROM payment_cycles c
   WHERE c.id = NEW.cycle_id;
  IF NEW.number_in_cycle > total_limit THEN
    RAISE EXCEPTION 'Session number % exceeds cycle limit %', NEW.number_in_cycle, total_limit
      USING ERRCODE = 'check_violation', CONSTRAINT = 'sessions_within_cycle_limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_within_cycle_limit
  BEFORE INSERT OR UPDATE OF cycle_id, number_in_cycle ON sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_session_cycle_limit();

-- Lowering a limit or removing a bonus must not leave sessions above the limit.
CREATE OR REPLACE FUNCTION assert_cycle_fits_sessions(p_cycle_id BIGINT) RETURNS void AS $$
DECLARE
  total_limit INTEGER;
  highest     INTEGER;
BEGIN
  SELECT c.base_limit + COALESCE((SELECT SUM(b.quantity) FROM bonuses b WHERE b.cycle_id = c.id), 0)
    INTO total_limit FROM payment_cycles c WHERE c.id = p_cycle_id;
  SELECT MAX(number_in_cycle) INTO highest FROM sessions WHERE cycle_id = p_cycle_id;
  IF total_limit IS NOT NULL AND highest IS NOT NULL AND highest > total_limit THEN
    RAISE EXCEPTION 'Cycle % would have limit % below session number %', p_cycle_id, total_limit, highest
      USING ERRCODE = 'check_violation', CONSTRAINT = 'cycle_limit_below_sessions';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_cycle_limit_after_change() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'payment_cycles' THEN
    PERFORM assert_cycle_fits_sessions(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM assert_cycle_fits_sessions(OLD.cycle_id);
  ELSE
    PERFORM assert_cycle_fits_sessions(NEW.cycle_id);
    IF TG_OP = 'UPDATE' AND OLD.cycle_id <> NEW.cycle_id THEN
      PERFORM assert_cycle_fits_sessions(OLD.cycle_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_cycles_limit_fits_sessions
  AFTER UPDATE OF base_limit ON payment_cycles
  FOR EACH ROW EXECUTE FUNCTION check_cycle_limit_after_change();

CREATE TRIGGER bonuses_limit_fits_sessions
  AFTER UPDATE OR DELETE ON bonuses
  FOR EACH ROW EXECUTE FUNCTION check_cycle_limit_after_change();

-- ---------------------------------------------------------------------------
-- Special events (surgery, holidays, pauses, …). Payments and bonuses have
-- their own tables and are merged with events in the timeline.
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title        TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  type         TEXT NOT NULL CHECK (type IN ('surgery', 'holiday', 'pause', 'resume', 'custom')),
  event_date   DATE NOT NULL,
  description  TEXT,
  import_key   TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_date_idx ON events (event_date);
CREATE INDEX events_type_idx ON events (type);
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Time milestones since surgery (indicators only, not clinical guidance).
-- ---------------------------------------------------------------------------
CREATE TABLE milestones (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  days        INTEGER NOT NULL UNIQUE CHECK (days BETWEEN 1 AND 3650),
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Single-row application settings.
-- ---------------------------------------------------------------------------
CREATE TABLE app_settings (
  id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- The surgery event whose date drives the "days since surgery" counter.
  surgery_event_id     BIGINT REFERENCES events (id) ON DELETE SET NULL,
  default_cycle_limit  INTEGER NOT NULL DEFAULT 40 CHECK (default_cycle_limit BETWEEN 1 AND 1000),
  time_zone            TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Derived per-cycle totals.
-- ---------------------------------------------------------------------------
CREATE VIEW cycle_overview AS
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
  s.last_session_date
FROM payment_cycles c
LEFT JOIN (
  SELECT cycle_id, SUM(quantity) AS bonus_total FROM bonuses GROUP BY cycle_id
) b ON b.cycle_id = c.id
LEFT JOIN (
  SELECT cycle_id,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
         COUNT(*) FILTER (WHERE status = 'pending')   AS pending_count,
         MAX(number_in_cycle)                         AS max_number,
         MIN(session_date)                            AS first_session_date,
         MAX(session_date)                            AS last_session_date
    FROM sessions GROUP BY cycle_id
) s ON s.cycle_id = c.id;
