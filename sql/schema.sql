CREATE TABLE IF NOT EXISTS members (
  member_id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT now(),
  star_total INT DEFAULT 0,
  star_rank TEXT DEFAULT 'Initiate',
  shares_awarded_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS star_transactions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bd_transactions (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  delta NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_events (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  share_platform TEXT,
  share_url TEXT,
  proof_url TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_reviews (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  business_name TEXT NOT NULL,
  business_address TEXT NOT NULL,
  service_type TEXT NOT NULL,
  what_makes_special TEXT NOT NULL,
  video_url TEXT NOT NULL,
  self_score INT DEFAULT 0,
  approved_stars INT,
  checklist_json JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  contest_id TEXT NOT NULL,
  contestant_id TEXT NOT NULL,
  votes INT NOT NULL DEFAULT 1,
  pay_with TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_free_votes (
  id SERIAL PRIMARY KEY,
  member_id TEXT REFERENCES members(member_id),
  month_key TEXT NOT NULL,
  free_votes_remaining INT NOT NULL DEFAULT 1,
  UNIQUE(member_id, month_key)
);

CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  contest_id TEXT NOT NULL,
  member_id TEXT REFERENCES members(member_id),
  amount_usd NUMERIC(12,2) NOT NULL,
  payout_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'issued',
  created_at TIMESTAMP DEFAULT now(),
  redeemed_at TIMESTAMP
);
