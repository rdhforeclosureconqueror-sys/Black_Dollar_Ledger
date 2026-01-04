-- ================================================================
-- 🦁 MUFASA CORE 2.0 DATABASE MIGRATION 
-- Purpose: Expand the Simba / Mufasa database into a unified system
-- Covering: Members, Fitness, Study, Forms, AI, Unified Ledger
-- ================================================================

-- 1️⃣ Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 2️⃣ MEMBERS (Upgraded Universal Member Table)
-- ================================================================
CREATE TABLE IF NOT EXISTS members (
  member_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  photo TEXT,
  role TEXT DEFAULT 'user',
  fitness_level TEXT DEFAULT 'beginner',
  study_focus TEXT DEFAULT NULL,
  total_stars INTEGER DEFAULT 0,
  total_bd INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  last_checkin TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Add new columns if the table already existed
ALTER TABLE members ADD COLUMN IF NOT EXISTS fitness_level TEXT DEFAULT 'beginner';
ALTER TABLE members ADD COLUMN IF NOT EXISTS study_focus TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ================================================================
-- 3️⃣ FITNESS EVENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS fitness_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,          -- 'workout' | 'hydration' | 'meal' | 'assessment'
  duration INTEGER DEFAULT 0,        -- minutes
  calories INTEGER DEFAULT 0,
  intensity TEXT DEFAULT 'normal',   -- 'low' | 'medium' | 'high'
  points_awarded INTEGER DEFAULT 0,
  ai_score NUMERIC(5,2) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'        -- posture data, movements, etc.
);

-- ================================================================
-- 4️⃣ STUDY EVENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS study_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,        -- 'journal' | 'lesson' | 'timeline_entry'
  content_ref TEXT DEFAULT NULL,     -- optional reference link or ID
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ================================================================
-- 5️⃣ MEMBER FORMS (In-House Google Forms)
-- ================================================================
CREATE TABLE IF NOT EXISTS member_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,           -- 'fitness_intake' | 'study_reflection' | etc.
  data JSONB NOT NULL,               -- entire form submission
  reviewed_by_admin BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- 6️⃣ UNIFIED LEDGER (All STARs, BD, XP)
-- ================================================================
CREATE TABLE IF NOT EXISTS ledger_unified (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  source TEXT NOT NULL,              -- 'share' | 'study' | 'fitness' | 'bonus'
  delta_stars INTEGER DEFAULT 0,
  delta_bd INTEGER DEFAULT 0,
  delta_xp INTEGER DEFAULT 0,
  reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ================================================================
-- 7️⃣ AI SESSIONS (TensorFlow + MufasaBrain Logs)
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,        -- 'workout_analysis' | 'movement_assessment' | 'plan_generation'
  model_version TEXT DEFAULT 'v1',
  score NUMERIC(5,2) DEFAULT NULL,
  input_data JSONB DEFAULT '{}',     -- raw camera/Unity data
  output_data JSONB DEFAULT '{}',    -- analysis results
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- 8️⃣ CONTENT BANKS (Affirmations, Tips, Lessons)
-- ================================================================
CREATE TABLE IF NOT EXISTS content_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,            -- 'affirmation' | 'tip' | 'lesson' | 'workout'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- ✅ DONE
-- ================================================================
COMMENT ON SCHEMA public IS 'Mufasa Core 2.0 — Unified Members, Fitness, Study, AI System';
