-- ============================================================
-- AIFilms V2 Migration - Token Auth, Categories, 50/50 Scoring
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TOKENS TABLE - Unified token auth for judges AND audience
-- ============================================================

CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL CHECK (token_type IN ('judge', 'audience')),
  person_name TEXT NOT NULL,
  category TEXT,  -- For judges: assigned category. NULL for audience.
  voter_id UUID REFERENCES voters(id),
  device_id TEXT,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_token_type ON tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_tokens_category ON tokens(category);
CREATE INDEX IF NOT EXISTS idx_tokens_voter_id ON tokens(voter_id);

-- RLS for tokens
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public to read tokens"
  ON tokens FOR SELECT USING (true);

CREATE POLICY "Allow public to update tokens"
  ON tokens FOR UPDATE USING (true);

CREATE POLICY "Allow public to insert tokens"
  ON tokens FOR INSERT WITH CHECK (true);

-- ============================================================
-- 2. ADD COLUMNS TO EXISTING TABLES
-- ============================================================

-- Voters: add name and token reference
ALTER TABLE voters ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE voters ADD COLUMN IF NOT EXISTS token_id UUID REFERENCES tokens(id);
CREATE INDEX IF NOT EXISTS idx_voters_token_id ON voters(token_id);
CREATE INDEX IF NOT EXISTS idx_voters_name ON voters(name);

-- Votes: ensure unique constraint for upserts (one vote per person per reel)
-- (Skip if already exists - run manually: ALTER TABLE votes ADD CONSTRAINT votes_reel_id_voter_id_key UNIQUE (reel_id, voter_id);)
DO $$ BEGIN
  ALTER TABLE votes ADD CONSTRAINT votes_reel_id_voter_id_key UNIQUE (reel_id, voter_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Votes: add denormalized voter_name and category for dashboard queries
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_name TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_votes_voter_name ON votes(voter_name);
CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category);

-- Vote aggregates: add category
ALTER TABLE vote_aggregates ADD COLUMN IF NOT EXISTS category TEXT;

-- ============================================================
-- 3. REPLACE AGGREGATE TRIGGER - 50/50 split, no *10 normalization
-- ============================================================

CREATE OR REPLACE FUNCTION update_vote_aggregate()
RETURNS TRIGGER AS $$
DECLARE
  v_judge_count INT;
  v_judge_sum INT;
  v_audience_count INT;
  v_audience_sum INT;
  v_judge_avg DECIMAL(5,2);
  v_audience_avg DECIMAL(5,2);
  v_final_score DECIMAL(5,2);
  v_category TEXT;
BEGIN
  -- Get category from the vote
  v_category := NEW.category;

  -- Ensure aggregate record exists
  INSERT INTO vote_aggregates (reel_id, category)
  VALUES (NEW.reel_id, COALESCE(v_category, ''))
  ON CONFLICT (reel_id) DO UPDATE SET category = COALESCE(v_category, vote_aggregates.category);

  -- Calculate judge stats (scores are 1-100, NO normalization)
  SELECT COUNT(*), COALESCE(SUM(score), 0)
  INTO v_judge_count, v_judge_sum
  FROM votes
  WHERE reel_id = NEW.reel_id AND voter_type = 'judge';

  -- Calculate audience stats (scores are 1-100)
  SELECT COUNT(*), COALESCE(SUM(score), 0)
  INTO v_audience_count, v_audience_sum
  FROM votes
  WHERE reel_id = NEW.reel_id AND voter_type = 'audience';

  -- Calculate averages
  IF v_judge_count > 0 THEN
    v_judge_avg := v_judge_sum::DECIMAL / v_judge_count;
  ELSE
    v_judge_avg := 0;
  END IF;

  IF v_audience_count > 0 THEN
    v_audience_avg := v_audience_sum::DECIMAL / v_audience_count;
  ELSE
    v_audience_avg := 0;
  END IF;

  -- 50/50 weighted score, both on 1-100 scale
  IF v_judge_count > 0 AND v_audience_count > 0 THEN
    v_final_score := (v_judge_avg * 0.5) + (v_audience_avg * 0.5);
  ELSIF v_judge_count > 0 THEN
    v_final_score := v_judge_avg;
  ELSIF v_audience_count > 0 THEN
    v_final_score := v_audience_avg;
  ELSE
    v_final_score := 0;
  END IF;

  -- Update aggregates
  UPDATE vote_aggregates
  SET
    judge_count = v_judge_count,
    judge_sum = v_judge_sum,
    judge_average = v_judge_avg,
    audience_count = v_audience_count,
    audience_sum = v_audience_sum,
    audience_average = v_audience_avg,
    final_score = v_final_score,
    category = COALESCE(v_category, category),
    updated_at = NOW()
  WHERE reel_id = NEW.reel_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create triggers
DROP TRIGGER IF EXISTS trigger_update_aggregate_insert ON votes;
DROP TRIGGER IF EXISTS trigger_update_aggregate_update ON votes;

CREATE TRIGGER trigger_update_aggregate_insert
AFTER INSERT ON votes
FOR EACH ROW EXECUTE FUNCTION update_vote_aggregate();

CREATE TRIGGER trigger_update_aggregate_update
AFTER UPDATE ON votes
FOR EACH ROW EXECUTE FUNCTION update_vote_aggregate();

-- ============================================================
-- 4. UPDATE REELS SEED DATA - 5 new categories, 10 per category
-- ============================================================

UPDATE reels SET category = 'Comedy' WHERE id IN ('reel-1', 'reel-2', 'reel-3', 'reel-4', 'reel-5', 'reel-6', 'reel-7', 'reel-8', 'reel-9', 'reel-10');
UPDATE reels SET category = 'Food Porn' WHERE id IN ('reel-11', 'reel-12', 'reel-13', 'reel-14', 'reel-15', 'reel-16', 'reel-17', 'reel-18', 'reel-19', 'reel-20');
UPDATE reels SET category = 'Edits' WHERE id IN ('reel-21', 'reel-22', 'reel-23', 'reel-24', 'reel-25', 'reel-26', 'reel-27', 'reel-28', 'reel-29', 'reel-30');
UPDATE reels SET category = 'Kidney Touching' WHERE id IN ('reel-31', 'reel-32', 'reel-33', 'reel-34', 'reel-35', 'reel-36', 'reel-37', 'reel-38', 'reel-39', 'reel-40');
UPDATE reels SET category = 'AI Slot' WHERE id IN ('reel-41', 'reel-42', 'reel-43', 'reel-44', 'reel-45', 'reel-46', 'reel-47', 'reel-48', 'reel-49', 'reel-50');

-- ============================================================
-- 5. VIEWS
-- ============================================================

-- Per-category leaderboard (must DROP first because column names changed)
DROP VIEW IF EXISTS v_leaderboard;
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
  r.id,
  r.reel_number,
  r.contestant_name,
  r.category,
  r.thumbnail_icon,
  COALESCE(va.judge_count, 0) as judge_count,
  COALESCE(va.judge_average, 0) as judge_average,
  COALESCE(va.audience_count, 0) as audience_count,
  COALESCE(va.audience_average, 0) as audience_average,
  COALESCE(va.final_score, 0) as final_score,
  ROW_NUMBER() OVER (
    PARTITION BY r.category
    ORDER BY COALESCE(va.final_score, 0) DESC
  ) as category_rank,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(va.final_score, 0) DESC
  ) as overall_rank
FROM reels r
LEFT JOIN vote_aggregates va ON r.id = va.reel_id
WHERE r.is_active = true
ORDER BY r.category, COALESCE(va.final_score, 0) DESC;

-- Dashboard view: all individual votes with names
CREATE OR REPLACE VIEW v_vote_log AS
SELECT
  v.id as vote_id,
  v.reel_id,
  r.reel_number,
  r.contestant_name,
  r.category as reel_category,
  v.voter_id,
  v.voter_name,
  v.voter_type,
  v.score,
  v.category as vote_category,
  v.created_at,
  v.updated_at
FROM votes v
LEFT JOIN reels r ON v.reel_id = r.id
ORDER BY v.created_at DESC;

-- ============================================================
-- 6. SEED JUDGE TOKENS (2 per category)
-- ============================================================

INSERT INTO tokens (token, token_type, person_name, category) VALUES
  ('J-COM-A7X9', 'judge', 'Comedy Judge 1', 'Comedy'),
  ('J-COM-B3K2', 'judge', 'Comedy Judge 2', 'Comedy'),
  ('J-FP-C8M1', 'judge', 'Food Porn Judge 1', 'Food Porn'),
  ('J-FP-D5N4', 'judge', 'Food Porn Judge 2', 'Food Porn'),
  ('J-EDT-E2P7', 'judge', 'Edits Judge 1', 'Edits'),
  ('J-EDT-F1Q3', 'judge', 'Edits Judge 2', 'Edits'),
  ('J-KT-G9R6', 'judge', 'KT Judge 1', 'Kidney Touching'),
  ('J-KT-H4S8', 'judge', 'KT Judge 2', 'Kidney Touching'),
  ('J-AI-I6T2', 'judge', 'AI Judge 1', 'AI Slot'),
  ('J-AI-J7U5', 'judge', 'AI Judge 2', 'AI Slot')
ON CONFLICT (token) DO NOTHING;

-- Seed sample audience tokens (for testing)
INSERT INTO tokens (token, token_type, person_name) VALUES
  ('V-TEST01', 'audience', 'Test Voter 1'),
  ('V-TEST02', 'audience', 'Test Voter 2'),
  ('V-TEST03', 'audience', 'Test Voter 3'),
  ('V-TEST04', 'audience', 'Test Voter 4'),
  ('V-TEST05', 'audience', 'Test Voter 5')
ON CONFLICT (token) DO NOTHING;
