-- ✅ PHASE 2 MIGRATION — Simba Universe Expansion (Fitness + Study + Language + AI)

BEGIN;

-- 🧍 MEMBERS (Ensure baseline structure)
CREATE TABLE IF NOT EXISTS members (
  member_id TEXT PRIMARY KEY,
  provider TEXT,
  display_name TEXT,
  email TEXT UNIQUE,
  photo TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🌍 FITNESS EVENTS
CREATE TABLE IF NOT EXISTS fitness_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN ('workout', 'water')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 📚 STUDY EVENTS (Journal + Shares)
CREATE TABLE IF NOT EXISTS study_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('journal', 'share')),
  title TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🗣️ LANGUAGE EVENTS
CREATE TABLE IF NOT EXISTS language_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  language_key TEXT,
  practice_date DATE DEFAULT CURRENT_DATE,
  recordings_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🧾 FORM SUBMISSIONS (Onboarding + Assessments)
CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  form_type TEXT,
  form_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🧠 AI SESSIONS (TensorFlow / Unity Integration)
CREATE TABLE IF NOT EXISTS ai_sessions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  session_id TEXT,
  summary_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🧮 XP + STAR TRANSACTIONS
CREATE TABLE IF NOT EXISTS xp_transactions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS star_transactions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🏁 REWARD RULES
CREATE TABLE IF NOT EXISTS reward_rules (
  id SERIAL PRIMARY KEY,
  category TEXT,
  trigger TEXT,
  xp_value INT DEFAULT 0,
  star_value INT DEFAULT 0,
  UNIQUE (category, trigger)
);

-- 🪙 DEFAULT REWARDS (XP + STARS)
INSERT INTO reward_rules (category, trigger, xp_value, star_value)
VALUES
  ('fitness', 'workout_complete', 10, 0),
  ('fitness', 'water_log', 3, 0),
  ('study', 'journal_entry', 0, 1),
  ('study', 'share_completed', 0, 1),
  ('language', 'daily_practice_complete', 0, 1)
ON CONFLICT (category, trigger) DO NOTHING;

-- 🦁 INDEX OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_fitness_member ON fitness_events (member_id);
CREATE INDEX IF NOT EXISTS idx_study_member ON study_events (member_id);
CREATE INDEX IF NOT EXISTS idx_language_member ON language_events (member_id);
CREATE INDEX IF NOT EXISTS idx_form_member ON form_submissions (member_id);
CREATE INDEX IF NOT EXISTS idx_ai_member ON ai_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_xp_member ON xp_transactions (member_id);
CREATE INDEX IF NOT EXISTS idx_star_member ON star_transactions (member_id);

COMMIT;
