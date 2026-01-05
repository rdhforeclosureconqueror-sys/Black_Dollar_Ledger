-- ✅ Phase 2 Migration — Fitness + Study + Language + AI
CREATE TABLE IF NOT EXISTS fitness_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  event_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  type TEXT,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS language_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  language_key TEXT,
  practice_date DATE,
  recordings_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  form_type TEXT,
  form_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_sessions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  session_id TEXT,
  summary_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_rules (
  id SERIAL PRIMARY KEY,
  category TEXT,
  trigger TEXT,
  xp_value INT DEFAULT 0,
  star_value INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  delta INT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default rewards
INSERT INTO reward_rules (category, trigger, xp_value, star_value) VALUES
('fitness', 'workout_complete', 10, 0),
('fitness', 'water_log', 3, 0),
('study', 'journal_entry', 0, 1),
('study', 'share_completed', 0, 1),
('language', 'daily_practice_complete', 0, 1)
ON CONFLICT DO NOTHING;
