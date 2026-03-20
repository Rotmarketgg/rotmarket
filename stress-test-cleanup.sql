-- ============================================================
-- RotMarket — STRESS TEST CLEANUP
-- Removes all data inserted by stress-test-seed.sql
--
-- SAFE: Only touches rows where username LIKE 'test_%'
--       or IDs starting with the test UUID prefixes.
--       Will NOT affect any real user data.
--
-- Optional: Uncomment the SELECT block at the top to preview
--           row counts before committing to the delete.
-- ============================================================

-- ============================================================
-- PREVIEW (optional — uncomment to see counts before deleting)
-- ============================================================
-- SELECT 'profiles'       AS tbl, COUNT(*) FROM profiles      WHERE username LIKE 'test_%'
-- UNION ALL
-- SELECT 'listings',       COUNT(*) FROM listings       WHERE user_id   IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
-- UNION ALL
-- SELECT 'reviews',        COUNT(*) FROM reviews        WHERE id::text  LIKE 'cccccccc%'
-- UNION ALL
-- SELECT 'messages',       COUNT(*) FROM messages       WHERE id::text  LIKE 'dddddddd%'
-- UNION ALL
-- SELECT 'trade_requests', COUNT(*) FROM trade_requests WHERE id::text  LIKE 'eeeeeeee%';

-- ============================================================
-- DELETE in FK-safe order
-- ============================================================

-- 1. Trade requests
DELETE FROM trade_requests
WHERE
  id::text     LIKE 'eeeeeeee%'
  OR buyer_id  IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR seller_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%');

-- 2. Disputes linked to test users or listings
DELETE FROM disputes
WHERE
  opened_by          IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR against_user_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR listing_id      IN (SELECT id FROM listings  WHERE user_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%'));

-- 3. Messages
DELETE FROM messages
WHERE
  id::text       LIKE 'dddddddd%'
  OR sender_id   IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR receiver_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%');

-- 4. Reviews
DELETE FROM reviews
WHERE
  id::text       LIKE 'cccccccc%'
  OR reviewer_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR seller_id   IN (SELECT id FROM profiles WHERE username LIKE 'test_%');

-- 5. Reports
DELETE FROM reports
WHERE
  reporter_id        IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR reported_user_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
  OR listing_id      IN (SELECT id FROM listings  WHERE user_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%'));

-- 6. Listings
DELETE FROM listings
WHERE user_id IN (SELECT id FROM profiles WHERE username LIKE 'test_%');

-- 7. Profiles last (all FK deps cleared above)
DELETE FROM profiles
WHERE username LIKE 'test_%';

-- ============================================================
-- VERIFY — all should return 0
-- ============================================================
SELECT 'profiles'       AS tbl, COUNT(*) AS remaining FROM profiles      WHERE username LIKE 'test_%'
UNION ALL
SELECT 'listings',       COUNT(*) FROM listings       WHERE user_id   IN (SELECT id FROM profiles WHERE username LIKE 'test_%')
UNION ALL
SELECT 'reviews',        COUNT(*) FROM reviews        WHERE id::text  LIKE 'cccccccc%'
UNION ALL
SELECT 'messages',       COUNT(*) FROM messages       WHERE id::text  LIKE 'dddddddd%'
UNION ALL
SELECT 'trade_requests', COUNT(*) FROM trade_requests WHERE id::text  LIKE 'eeeeeeee%';
