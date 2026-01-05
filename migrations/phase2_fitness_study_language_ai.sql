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

CREATE TABLE IF NOT EXISTS ai_holistic_state (
  member_id TEXT PRIMARY KEY REFERENCES members(member_id),
  physical_score NUMERIC DEFAULT 0,
  mental_score NUMERIC DEFAULT 0,
  linguistic_score NUMERIC DEFAULT 0,
  cultural_score NUMERIC DEFAULT 0,
  overall_health NUMERIC DEFAULT 0,
  last_sync TIMESTAMP DEFAULT NOW(),
  history JSONB DEFAULT '[]'::jsonb
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

-- ✅ AI METRICS TABLE
CREATE TABLE IF NOT EXISTS ai_metrics (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  metric_type TEXT CHECK (metric_type IN ('motion','voice','journal')),
  score NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ✅ AI MODELS (optional for tracking training)
CREATE TABLE IF NOT EXISTS ai_models (
  id SERIAL PRIMARY KEY,
  model_name TEXT,
  version TEXT,
  parameters JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ✅ ai_adaptive_profiles — stores user learning patterns
CREATE TABLE IF NOT EXISTS ai_adaptive_profiles (
  member_id TEXT PRIMARY KEY REFERENCES members(member_id),
  motion_avg NUMERIC DEFAULT 0,
  voice_avg NUMERIC DEFAULT 0,
  journal_avg NUMERIC DEFAULT 0,
  consistency_score NUMERIC DEFAULT 0,
  current_difficulty NUMERIC DEFAULT 1,
  last_adapted TIMESTAMP DEFAULT NOW(),
  evolution_state JSONB DEFAULT '{}'::jsonb
);

-- ✅ ai_recommendations — stores active AI guidance
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  category TEXT CHECK (category IN ('motion','voice','journal','study')),
  recommendation TEXT,
  impact TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ai_movement_sessions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  session_id TEXT UNIQUE,
  movement_type TEXT,
  reps INTEGER DEFAULT 0,
  accuracy NUMERIC DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);


COMMIT;
