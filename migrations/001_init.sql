BEGIN;

-- 0) MEMBERS (keep your existing structure, but ensure columns match)
-- If members already exists, we’ll add missing columns safely.

CREATE TABLE IF NOT EXISTS members (
  id           text PRIMARY KEY,
  provider     text NOT NULL,
  display_name text,
  email        text,
  photo        text,
  created_at   timestamp without time zone DEFAULT now()
);

-- If table already existed with these columns, these are no-ops:
ALTER TABLE members ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT now();

-- Ensure provider is NOT NULL (your error came from inserting null provider)
UPDATE members SET provider = 'google' WHERE provider IS NULL;
ALTER TABLE members ALTER COLUMN provider SET NOT NULL;

-- 1) SESSION (Render connect-pg-simple uses "session")
CREATE TABLE IF NOT EXISTS session (
  sid    varchar NOT NULL PRIMARY KEY,
  sess   json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- 2) BD TRANSACTIONS (ledger style: delta table)
CREATE TABLE IF NOT EXISTS bd_transactions (
  id           bigserial PRIMARY KEY,
  member_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  delta        numeric NOT NULL,                 -- positive or negative
  reason       text NOT NULL,                    -- "founding_balance", "purchase", "reward", etc.
  ref_type     text,                             -- "video_review", "share_event", "manual", etc.
  ref_id       text,                             -- external reference id if needed
  created_at   timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bd_member ON bd_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_bd_created ON bd_transactions(created_at);

-- 3) STAR TRANSACTIONS (ledger style: delta table)
CREATE TABLE IF NOT EXISTS star_transactions (
  id           bigserial PRIMARY KEY,
  member_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  delta        integer NOT NULL,                 -- positive or negative
  reason       text NOT NULL,                    -- "share_bonus", "video_review", etc.
  ref_type     text,
  ref_id       text,
  created_at   timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_star_member ON star_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_star_created ON star_transactions(created_at);

-- 4) SHARE EVENTS (raw events; stars can be derived or awarded)
CREATE TABLE IF NOT EXISTS share_events (
  id            bigserial PRIMARY KEY,
  member_id     text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  share_platform text NOT NULL,                  -- "tiktok", "instagram", etc.
  share_url     text,
  proof_url     text,
  created_at    timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_member ON share_events(member_id);
CREATE INDEX IF NOT EXISTS idx_share_created ON share_events(created_at);

-- 5) VIDEO REVIEW SUBMISSIONS (pending approval flow)
CREATE TABLE IF NOT EXISTS video_reviews (
  id              bigserial PRIMARY KEY,
  member_id        text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  business_name    text NOT NULL,
  business_address text,
  service_type     text,
  what_makes_special text,
  video_url        text NOT NULL,
  self_score       integer NOT NULL DEFAULT 0,
  checklist_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'pending',   -- pending|approved|rejected
  admin_note       text,
  approved_by      text,                             -- admin member_id or email
  approved_at      timestamp without time zone,
  created_at       timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_member ON video_reviews(member_id);
CREATE INDEX IF NOT EXISTS idx_video_status ON video_reviews(status);
CREATE INDEX IF NOT EXISTS idx_video_created ON video_reviews(created_at);

-- 6) OPTIONAL: LEDGER_ENTRIES (if you still want unified table)
-- You already have ledger_entries. We ensure it exists + aligns.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id           bigserial PRIMARY KEY,
  member_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount       numeric NOT NULL,
  type         text NOT NULL,      -- credit|debit
  description  text,
  created_at   timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_member ON ledger_entries(member_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at);

COMMIT;

