-- ============================================
-- AIFilms Supabase Verification Queries
-- Run these in Supabase SQL Editor to verify setup
-- ============================================

-- 1. Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: voters, votes, vote_aggregates

-- 2. Check voters table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'voters'
ORDER BY ordinal_position;

-- 3. Check votes table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'votes'
ORDER BY ordinal_position;

-- 4. Check vote_aggregates table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vote_aggregates'
ORDER BY ordinal_position;

-- 5. List all registered devices
SELECT id, device_id, device_type, is_judge, created_at, last_seen_at
FROM voters
ORDER BY created_at DESC
LIMIT 20;

-- 6. List all votes
SELECT v.id, v.reel_id, v.score, v.voter_type, v.created_at,
       vt.device_id
FROM votes v
LEFT JOIN voters vt ON v.voter_id = vt.id
ORDER BY v.created_at DESC
LIMIT 50;

-- 7. Check vote aggregates (scores per reel)
SELECT reel_id,
       audience_count,
       judge_count,
       audience_average,
       judge_average,
       final_score,
       updated_at
FROM vote_aggregates
ORDER BY final_score DESC;

-- 8. Check RLS policies are enabled
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9. Check triggers exist
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 10. Count summary
SELECT
  (SELECT COUNT(*) FROM voters) as total_voters,
  (SELECT COUNT(*) FROM voters WHERE is_judge = true) as total_judges,
  (SELECT COUNT(*) FROM votes) as total_votes,
  (SELECT COUNT(*) FROM votes WHERE voter_type = 'audience') as audience_votes,
  (SELECT COUNT(*) FROM votes WHERE voter_type = 'judge') as judge_votes,
  (SELECT COUNT(*) FROM vote_aggregates) as reels_with_votes;

-- ============================================
-- RESET DATA (Use with caution!)
-- ============================================

-- Clear all votes (keeps device registrations)
-- DELETE FROM votes;
-- DELETE FROM vote_aggregates;

-- Full reset (removes everything)
-- DELETE FROM votes;
-- DELETE FROM vote_aggregates;
-- DELETE FROM voters;
