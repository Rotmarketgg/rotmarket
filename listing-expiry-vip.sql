-- ============================================================
-- RotMarket — Listing Expiry, VIP Limits, Revenue Features
-- Run in Supabase SQL Editor after MASTER-FIX.sql
-- ============================================================

-- ============================================================
-- 1. ADD expires_at TO LISTINGS
-- ============================================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS renewed_at timestamp with time zone;

-- Set expiry for all existing active listings (30 days from creation)
UPDATE listings
SET expires_at = created_at + interval '30 days'
WHERE expires_at IS NULL AND status = 'active';

-- ============================================================
-- 2. AUTO-EXPIRE TRIGGER — runs on every listing insert
-- ============================================================
CREATE OR REPLACE FUNCTION set_listing_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Normal users: 7 days. Verified Trader: 14 days. VIP/Owner: 30 days.
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND badge IN ('VIP', 'Owner')) THEN
    NEW.expires_at := now() + interval '30 days';
  ELSIF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND badge = 'Verified Trader') THEN
    NEW.expires_at := now() + interval '14 days';
  ELSE
    NEW.expires_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_expiry_trigger ON listings;
CREATE TRIGGER listing_expiry_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION set_listing_expiry();

-- ============================================================
-- 3. FUNCTION TO EXPIRE LISTINGS
-- Run this daily via Supabase's pg_cron or call from a
-- scheduled Edge Function / external cron job
-- ============================================================
CREATE OR REPLACE FUNCTION expire_old_listings()
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired AS (
    UPDATE listings
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add 'expired' to listings status check constraint
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'sold', 'deleted', 'expired'));

-- Update RLS: expired listings still visible (so sellers can renew)
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON listings;
CREATE POLICY "Listings are viewable by everyone"
  ON listings FOR SELECT
  USING (status != 'deleted');

-- ============================================================
-- 4. RENEW LISTING FUNCTION
-- Sellers can renew an expired listing for another 30/60 days
-- ============================================================
CREATE OR REPLACE FUNCTION renew_listing(listing_id uuid)
RETURNS void AS $$
DECLARE
  lister_id     uuid;
  user_badge    text;
  renewal_days  integer;
BEGIN
  SELECT user_id INTO lister_id FROM listings WHERE id = listing_id;
  IF lister_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT badge INTO user_badge FROM profiles WHERE id = auth.uid();

  renewal_days := CASE
    WHEN user_badge IN ('VIP', 'Owner') THEN 30
    WHEN user_badge = 'Verified Trader' THEN 14
    ELSE 7
  END;

  UPDATE listings SET
    status     = 'active',
    expires_at = now() + (renewal_days || ' days')::interval,
    renewed_at = now(),
    promoted   = false
  WHERE id = listing_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. REPLACE LISTING RATE LIMIT WITH TIER-AWARE VERSION
-- Normal users:    3/day,  15-min cooldown
-- Verified Trader: 5/day,  15-min cooldown
-- VIP/Owner:       10/day, no cooldown
-- ============================================================
CREATE OR REPLACE FUNCTION check_listing_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_badge text;
  is_vip boolean;
  is_verified boolean;
  daily_limit integer;
  cooldown_minutes integer;
  recent_count_cooldown integer;
  recent_count_day integer;
BEGIN
  -- Get user badge
  SELECT badge INTO user_badge FROM profiles WHERE id = NEW.user_id;

  is_vip      := user_badge IN ('VIP', 'Owner');
  is_verified := user_badge = 'Verified Trader';

  -- Set limits by tier
  IF is_vip THEN
    daily_limit      := 10;
    cooldown_minutes := 0;   -- no cooldown
  ELSIF is_verified THEN
    daily_limit      := 5;
    cooldown_minutes := 15;
  ELSE
    daily_limit      := 3;
    cooldown_minutes := 15;
  END IF;

  -- Per-cooldown check (skip for VIP)
  IF cooldown_minutes > 0 THEN
    SELECT COUNT(*) INTO recent_count_cooldown
    FROM listings
    WHERE user_id = NEW.user_id
      AND created_at > now() - (cooldown_minutes || ' minutes')::interval;

    IF recent_count_cooldown >= 1 THEN
      RAISE EXCEPTION 'Rate limit: Please wait % minutes before posting another listing.', cooldown_minutes;
    END IF;
  END IF;

  -- Daily cap
  SELECT COUNT(*) INTO recent_count_day
  FROM listings
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';

  IF recent_count_day >= daily_limit THEN
    RAISE EXCEPTION 'Rate limit: You have reached your % listing limit for today. Upgrade to VIP for 10 listings/day.', daily_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_rate_limit_trigger ON listings;
CREATE TRIGGER listing_rate_limit_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION check_listing_rate_limit();

-- ============================================================
-- 6. PROMOTED LISTINGS — boost for 7 days
-- After promote_listing() is called (by Owner after payment confirmed),
-- listing jumps to top and gets a promoted badge
-- ============================================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_until timestamp with time zone;

CREATE OR REPLACE FUNCTION promote_listing(listing_id uuid, days integer DEFAULT 7)
RETURNS void AS $$
BEGIN
  -- Only Owner can promote (after confirming payment)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND badge = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;

  UPDATE listings SET
    promoted = true,
    promoted_until = now() + (days || ' days')::interval
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire promotions (run daily alongside expire_old_listings)
CREATE OR REPLACE FUNCTION expire_promotions()
RETURNS integer AS $$
DECLARE
  count integer;
BEGIN
  WITH expired AS (
    UPDATE listings
    SET promoted = false, promoted_until = NULL
    WHERE promoted = true
      AND promoted_until IS NOT NULL
      AND promoted_until < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO count FROM expired;
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. DAILY MAINTENANCE FUNCTION
-- Call this once per day from a cron job or Edge Function
-- ============================================================
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS jsonb AS $$
DECLARE
  expired_listings integer;
  expired_promotions integer;
BEGIN
  SELECT expire_old_listings() INTO expired_listings;
  SELECT expire_promotions() INTO expired_promotions;

  RETURN jsonb_build_object(
    'expired_listings', expired_listings,
    'expired_promotions', expired_promotions,
    'run_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS listings_expires_at_idx ON listings(expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS listings_promoted_idx ON listings(promoted, promoted_until)
  WHERE promoted = true;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  COUNT(*) FILTER (WHERE promoted = true) as promoted,
  MIN(expires_at) as earliest_expiry,
  MAX(expires_at) as latest_expiry
FROM listings;
