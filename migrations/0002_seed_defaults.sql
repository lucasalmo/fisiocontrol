-- Default categories, milestones, settings and the initial surgery date.
-- Everything here is editable from the Settings page.

INSERT INTO session_categories (name, normalized_name, color) VALUES
  ('TOM',               'tom',               '#6366f1'),
  ('Intensidade',       'intensidade',       '#ef4444'),
  ('Coordenação',       'coordenacao',       '#0ea5e9'),
  ('Sensório Motor',    'sensorio motor',    '#14b8a6'),
  ('Areia',             'areia',             '#f59e0b'),
  ('Areia Moreira',     'areia moreira',     '#d97706'),
  ('Volume',            'volume',            '#8b5cf6'),
  ('Corrida e Saltos',  'corrida e saltos',  '#22c55e'),
  ('Habilidade',        'habilidade',        '#ec4899'),
  ('Explosão',          'explosao',          '#f97316'),
  ('Adaptado Explosão', 'adaptado explosao', '#fb923c'),
  ('Máquinas',          'maquinas',          '#64748b'),
  ('Outro',             'outro',             '#94a3b8')
ON CONFLICT (normalized_name) DO NOTHING;

INSERT INTO milestones (days) VALUES (30), (60), (90), (180), (365)
ON CONFLICT (days) DO NOTHING;

WITH surgery AS (
  INSERT INTO events (title, type, event_date, import_key)
  VALUES ('Cirurgia', 'surgery', DATE '2026-03-31', 'surgery:2026-03-31')
  RETURNING id
)
INSERT INTO app_settings (id, surgery_event_id, default_cycle_limit)
SELECT 1, id, 40 FROM surgery
ON CONFLICT (id) DO NOTHING;
