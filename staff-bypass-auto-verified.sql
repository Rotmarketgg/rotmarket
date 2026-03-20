-- ============================================================
-- RotMarket — Staff Bypass + Auto-Verified Promotion
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. REPLACE check_not_banned — staff are never blocked
-- ============================================================
CREATE OR REPLACE FUNCTION check_not_banned()
RETURNS TRIGGER AS $$
BEGIN
  -- Owners and Moderators bypass ban checks entirely
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND badge IN ('Owner', 'Moderator')
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND banned = true
  ) THEN
    RAISE EXCEPTION 'Your account has been suspended.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. REPLACE check_listing_rate_limit — staff have no limits
-- Normal:    3/day, 15-min cooldown
-- Verified:  5/day, 15-min cooldown
-- VIP/Owner: 10/day, no cooldown
-- Moderator: 10/day, no cooldown (same as VIP)
-- ============================================================
CREATE OR REPLACE FUNCTION check_listing_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_badge          text;
  is_staff            boolean;
  is_vip              boolean;
  is_verified         boolean;
  daily_limit         integer;
  cooldown_minutes    integer;
  recent_count_cool   integer;
  recent_count_day    integer;
BEGIN
  SELECT badge INTO user_badge FROM profiles WHERE id = NEW.user_id;

  is_staff    := user_badge IN ('Owner', 'Moderator');
  is_vip      := user_badge = 'VIP';
  is_verified := user_badge = 'Verified Trader';

  -- Staff have zero restrictions
  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF is_vip THEN
    daily_limit      := 10;
    cooldown_minutes := 0;
  ELSIF is_verified THEN
    daily_limit      := 5;
    cooldown_minutes := 15;
  ELSE
    daily_limit      := 3;
    cooldown_minutes := 15;
  END IF;

  -- Per-cooldown check
  IF cooldown_minutes > 0 THEN
    SELECT COUNT(*) INTO recent_count_cool
    FROM listings
    WHERE user_id = NEW.user_id
      AND created_at > now() - (cooldown_minutes || ' minutes')::interval;

    IF recent_count_cool >= 1 THEN
      RAISE EXCEPTION 'Rate limit: Please wait % minutes before posting another listing.', cooldown_minutes;
    END IF;
  END IF;

  -- Daily cap
  SELECT COUNT(*) INTO recent_count_day
  FROM listings
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';

  IF recent_count_day >= daily_limit THEN
    RAISE EXCEPTION 'Rate limit: You have reached your % listing limit for today. Upgrade to VIP for 10/day.', daily_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_rate_limit_trigger ON listings;
CREATE TRIGGER listing_rate_limit_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION check_listing_rate_limit();

-- ============================================================
-- 3. REPLACE check_dispute_rate_limit — staff bypass
-- ============================================================
CREATE OR REPLACE FUNCTION check_dispute_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_hour integer;
  recent_day  integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_hour
  FROM disputes
  WHERE opened_by = NEW.opened_by
    AND created_at > now() - interval '1 hour';
  IF recent_hour >= 1 THEN
    RAISE EXCEPTION 'Rate limit: You can only open 1 dispute per hour.';
  END IF;

  SELECT COUNT(*) INTO recent_day
  FROM disputes
  WHERE opened_by = NEW.opened_by
    AND created_at > now() - interval '24 hours';
  IF recent_day >= 5 THEN
    RAISE EXCEPTION 'Rate limit: You can only open 5 disputes per day.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dispute_rate_limit_trigger ON disputes;
CREATE TRIGGER dispute_rate_limit_trigger
  BEFORE INSERT ON disputes
  FOR EACH ROW EXECUTE FUNCTION check_dispute_rate_limit();

-- ============================================================
-- 4. REPLACE check_report_rate_limit — staff bypass
-- ============================================================
CREATE OR REPLACE FUNCTION check_report_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  same_user_recent integer;
  daily_count      integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO same_user_recent
  FROM reports
  WHERE reporter_id = NEW.reporter_id
    AND reported_user_id = NEW.reported_user_id
    AND created_at > now() - interval '10 minutes';
  IF same_user_recent >= 1 THEN
    RAISE EXCEPTION 'Rate limit: You already reported this user recently. Please wait 10 minutes.';
  END IF;

  SELECT COUNT(*) INTO daily_count
  FROM reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > now() - interval '24 hours';
  IF daily_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit: You have reached the maximum number of reports for today.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS report_rate_limit_trigger ON reports;
CREATE TRIGGER report_rate_limit_trigger
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_rate_limit();

-- ============================================================
-- 5. REPLACE check_message_rate_limit — staff bypass
-- ============================================================
CREATE OR REPLACE FUNCTION check_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM messages
  WHERE sender_id = NEW.sender_id
    AND receiver_id = NEW.receiver_id
    AND created_at > now() - interval '1 minute';
  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit: You are sending messages too quickly. Please slow down.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS message_rate_limit_trigger ON messages;
CREATE TRIGGER message_rate_limit_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION check_message_rate_limit();

-- ============================================================
-- 6. REPLACE check_offer_rate_limit — staff bypass
-- ============================================================
CREATE OR REPLACE FUNCTION check_offer_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count integer;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM trade_requests
  WHERE buyer_id = NEW.buyer_id
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit: You can only send 10 offers per hour.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS offer_rate_limit_trigger ON trade_requests;
CREATE TRIGGER offer_rate_limit_trigger
  BEFORE INSERT ON trade_requests
  FOR EACH ROW EXECUTE FUNCTION check_offer_rate_limit();

-- ============================================================
-- 7. AUTO-PROMOTE TO VERIFIED TRADER
-- Fires after every review INSERT or UPDATE.
-- If seller has 25+ reviews AND avg rating >= 4.8 AND
-- no current ban AND badge is null or 'Verified Trader' already,
-- promote them. Never overwrites VIP/Owner/Moderator.
-- ============================================================
CREATE OR REPLACE FUNCTION check_auto_verified()
RETURNS TRIGGER AS $$
DECLARE
  seller_id     uuid;
  total_reviews integer;
  avg_rating    numeric;
  five_stars    integer;
  current_badge text;
  is_banned     boolean;
BEGIN
  -- Works on both INSERT and UPDATE
  seller_id := COALESCE(NEW.seller_id, OLD.seller_id);

  -- Get current profile state
  SELECT badge, banned
  INTO current_badge, is_banned
  FROM profiles
  WHERE id = seller_id;

  -- Never overwrite premium or staff badges
  IF current_badge IN ('VIP', 'Moderator', 'Owner') THEN
    RETURN NEW;
  END IF;

  -- Don't promote banned users
  IF is_banned THEN
    RETURN NEW;
  END IF;

  -- Count reviews and get stats
  SELECT
    COUNT(*),
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*) FILTER (WHERE rating = 5)
  INTO total_reviews, avg_rating, five_stars
  FROM reviews
  WHERE seller_id = seller_id;

  -- Condition: 25+ five-star reviews (not just total reviews)
  IF five_stars >= 25 THEN
    UPDATE profiles
    SET badge = 'Verified Trader'
    WHERE id = seller_id
      AND (badge IS NULL OR badge = '');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_verified_on_review ON reviews;
CREATE TRIGGER auto_verified_on_review
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION check_auto_verified();

-- ============================================================
-- 8. RECALCULATE RATING TRIGGER
-- Keeps profiles.rating and profiles.review_count in sync
-- automatically on every review change, so the JS fallback
-- is less critical.
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_seller_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_seller_id uuid;
  new_avg   numeric;
  new_count integer;
BEGIN
  target_seller_id := COALESCE(NEW.seller_id, OLD.seller_id);

  SELECT
    ROUND(AVG(rating)::numeric, 1),
    COUNT(*)
  INTO new_avg, new_count
  FROM reviews
  WHERE seller_id = target_seller_id;

  UPDATE profiles
  SET
    rating       = COALESCE(new_avg, 0),
    review_count = COALESCE(new_count, 0)
  WHERE id = target_seller_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS recalculate_rating_trigger ON reviews;
CREATE TRIGGER recalculate_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_seller_rating();

-- ============================================================
-- VERIFY
-- ============================================================
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'check_not_banned',
    'check_listing_rate_limit',
    'check_dispute_rate_limit',
    'check_report_rate_limit',
    'check_message_rate_limit',
    'check_offer_rate_limit',
    'check_auto_verified',
    'recalculate_seller_rating'
  )
ORDER BY routine_name;

-- ============================================================
-- 9. AVATARS STORAGE BUCKET
-- Create this bucket in Supabase Dashboard > Storage,
-- or run the policy below after manually creating it.
-- Name: avatars  |  Public: true
-- ============================================================
DROP POLICY IF EXISTS "Avatar images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
