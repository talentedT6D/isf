-- ============================================================
-- AIFilms Live Voting System - Supabase Database Schema
-- Supports 600 concurrent users with real-time aggregation
-- ============================================================

-- 1. VOTERS TABLE - Track unique devices/sessions
CREATE TABLE IF NOT EXISTS voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  is_judge BOOLEAN DEFAULT false,
  judge_name TEXT,
  total_votes_cast INT DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. VOTES TABLE - Individual votes
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id TEXT NOT NULL,
  voter_id UUID NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 100),
  voter_type TEXT NOT NULL CHECK (voter_type IN ('audience', 'judge')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One vote per voter per reel
  UNIQUE(reel_id, voter_id)
);

-- 3. VOTE_AGGREGATES TABLE - Pre-computed stats for performance
CREATE TABLE IF NOT EXISTS vote_aggregates (
  reel_id TEXT PRIMARY KEY,
  judge_count INT DEFAULT 0,
  judge_sum INT DEFAULT 0,
  judge_average DECIMAL(5,2) DEFAULT 0,
  audience_count INT DEFAULT 0,
  audience_sum INT DEFAULT 0,
  audience_average DECIMAL(5,2) DEFAULT 0,
  final_score DECIMAL(5,2) DEFAULT 0, -- Weighted: 60% judge, 40% audience
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. REELS TABLE - Store reel metadata (optional, can use hardcoded data)
CREATE TABLE IF NOT EXISTS reels (
  id TEXT PRIMARY KEY,
  reel_number INT NOT NULL,
  contestant_name TEXT NOT NULL,
  category TEXT NOT NULL,
  video_url TEXT,
  thumbnail_icon TEXT,
  duration_seconds INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE AT SCALE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_votes_reel_id ON votes(reel_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_type ON votes(voter_type);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voters_device_id ON voters(device_id);
CREATE INDEX IF NOT EXISTS idx_voters_is_judge ON voters(is_judge);
CREATE INDEX IF NOT EXISTS idx_vote_aggregates_final_score ON vote_aggregates(final_score DESC);

-- ============================================================
-- FUNCTION: Update vote aggregates on insert/update
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
BEGIN
  -- Ensure aggregate record exists
  INSERT INTO vote_aggregates (reel_id)
  VALUES (NEW.reel_id)
  ON CONFLICT (reel_id) DO NOTHING;

  -- Calculate judge stats (scores are 1-10, stored as 1-10)
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

  -- Calculate final weighted score
  -- Judge scores are 1-10 (multiply by 10 to normalize to 100)
  -- Audience scores are 1-100
  -- Weight: 60% judge, 40% audience
  IF v_judge_count > 0 AND v_audience_count > 0 THEN
    v_final_score := (v_judge_avg * 10 * 0.6) + (v_audience_avg * 0.4);
  ELSIF v_judge_count > 0 THEN
    v_final_score := v_judge_avg * 10;
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
    updated_at = NOW()
  WHERE reel_id = NEW.reel_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Update voter stats on vote
-- ============================================================

CREATE OR REPLACE FUNCTION update_voter_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE voters
  SET
    last_seen_at = NOW(),
    total_votes_cast = total_votes_cast + 1
  WHERE id = NEW.voter_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_aggregate_insert ON votes;
DROP TRIGGER IF EXISTS trigger_update_aggregate_update ON votes;
DROP TRIGGER IF EXISTS trigger_update_voter_stats ON votes;

-- Create triggers
CREATE TRIGGER trigger_update_aggregate_insert
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_vote_aggregate();

CREATE TRIGGER trigger_update_aggregate_update
AFTER UPDATE ON votes
FOR EACH ROW
EXECUTE FUNCTION update_vote_aggregate();

CREATE TRIGGER trigger_update_voter_stats
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_voter_stats();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- Voters: Anyone can create and read
CREATE POLICY "Allow public to insert voters"
  ON voters FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public to read voters"
  ON voters FOR SELECT
  USING (true);

CREATE POLICY "Allow public to update own voter record"
  ON voters FOR UPDATE
  USING (true);

-- Votes: Anyone can create, read, and update their own
CREATE POLICY "Allow public to insert votes"
  ON votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public to read votes"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "Allow public to update votes"
  ON votes FOR UPDATE
  USING (true);

-- Vote Aggregates: Read-only for everyone
CREATE POLICY "Allow public to read aggregates"
  ON vote_aggregates FOR SELECT
  USING (true);

-- Reels: Read-only for everyone
CREATE POLICY "Allow public to read reels"
  ON reels FOR SELECT
  USING (true);

-- ============================================================
-- VIEWS
-- ============================================================

-- Leaderboard view sorted by final score
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
  ROW_NUMBER() OVER (ORDER BY COALESCE(va.final_score, 0) DESC) as rank
FROM reels r
LEFT JOIN vote_aggregates va ON r.id = va.reel_id
WHERE r.is_active = true
ORDER BY COALESCE(va.final_score, 0) DESC;

-- Live voting stats view
CREATE OR REPLACE VIEW v_voting_stats AS
SELECT
  (SELECT COUNT(DISTINCT id) FROM voters) as total_voters,
  (SELECT COUNT(*) FROM votes) as total_votes,
  (SELECT COUNT(*) FROM votes WHERE voter_type = 'judge') as judge_votes,
  (SELECT COUNT(*) FROM votes WHERE voter_type = 'audience') as audience_votes,
  (SELECT COUNT(DISTINCT reel_id) FROM votes) as reels_with_votes;

-- ============================================================
-- SEED DATA: Insert reel records (matching sync.js MOCK_REELS)
-- ============================================================

INSERT INTO reels (id, reel_number, contestant_name, category, video_url, thumbnail_icon, duration_seconds)
VALUES
  ('reel-1', 1, 'Arjun Mehta', 'Dance', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-01.mp4', 'user', 45),
  ('reel-2', 2, 'Priya Sharma', 'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-02.mp4', 'user', 30),
  ('reel-3', 3, 'Rahul Verma', 'Music', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-03.mp4', 'user', 60),
  ('reel-4', 4, 'Ananya Patel', 'Dance', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-04.mp4', 'user', 40),
  ('reel-5', 5, 'Vikram Singh', 'Drama', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-05.mp4', 'user', 55),
  ('reel-6', 6, 'Neha Gupta', 'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-06.mp4', 'user', 35),
  ('reel-7', 7, 'Aditya Kumar', 'Music', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-07.mp4', 'user', 50),
  ('reel-8', 8, 'Kavya Nair', 'Dance', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-08.mp4', 'user', 45),
  ('reel-9', 9, 'Rohan Joshi', 'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-09.mp4', 'user', 40),
  ('reel-10', 10, 'Simran Kaur', 'Drama', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-10.mp4', 'user', 60)
ON CONFLICT (id) DO UPDATE SET
  contestant_name = EXCLUDED.contestant_name,
  category = EXCLUDED.category,
  video_url = EXCLUDED.video_url;
