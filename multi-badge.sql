-- ============================================================
-- RotMarket — Multi-Badge System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add badges array column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}';

-- 2. Migrate existing badge -> badges array
UPDATE profiles
SET badges = ARRAY[badge]
WHERE badge IS NOT NULL AND badge != ''
  AND (badges IS NULL OR badges = '{}' OR array_length(badges, 1) IS NULL);

-- 3. Helper: get primary badge (highest in hierarchy)
CREATE OR REPLACE FUNCTION get_primary_badge(badges text[])
RETURNS text AS $$
DECLARE
  hierarchy text[] := ARRAY['Owner', 'Moderator', 'VIP', 'Verified Trader'];
  b text;
BEGIN
  IF badges IS NULL OR array_length(badges, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH b IN ARRAY hierarchy LOOP
    IF b = ANY(badges) THEN RETURN b; END IF;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Updated admin_update_profile RPC — sets full badges array
CREATE OR REPLACE FUNCTION admin_update_profile(
  target_id uuid,
  new_badges text[] DEFAULT NULL,
  new_banned boolean DEFAULT NULL,
  new_ban_reason text DEFAULT NULL,
  -- Legacy single badge param kept for backward compat
  new_badge text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET
    -- If new_badges array provided, use it; else if legacy new_badge provided, wrap in array
    badges = CASE
      WHEN new_badges IS NOT NULL THEN new_badges
      WHEN new_badge IS NOT NULL AND new_badge != '' THEN ARRAY[new_badge]
      WHEN new_badge = '' THEN '{}'::text[]
      ELSE badges
    END,
    -- Keep legacy badge column in sync with primary badge
    badge = CASE
      WHEN new_badges IS NOT NULL THEN get_primary_badge(new_badges)
      WHEN new_badge IS NOT NULL THEN NULLIF(new_badge, '')
      ELSE badge
    END,
    banned = COALESCE(new_banned, banned),
    ban_reason = CASE WHEN new_banned IS NOT NULL THEN new_ban_reason ELSE ban_reason END
  WHERE id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Updated auto-verified trigger — adds to badges array, keeps hierarchy
CREATE OR REPLACE FUNCTION check_auto_verified()
RETURNS TRIGGER AS $$
DECLARE
  target_seller_id uuid;
  five_stars    integer;
  current_badges text[];
  is_banned     boolean;
BEGIN
  target_seller_id := COALESCE(NEW.seller_id, OLD.seller_id);

  SELECT badges, banned INTO current_badges, is_banned
  FROM profiles WHERE id = target_seller_id;

  -- Don't promote banned users
  IF is_banned THEN RETURN NEW; END IF;

  -- Count five-star reviews
  SELECT COUNT(*) FILTER (WHERE rating = 5)
  INTO five_stars
  FROM reviews WHERE seller_id = target_seller_id;

  -- Add Verified Trader to badges array if threshold met and not already there
  IF five_stars >= 25 AND NOT ('Verified Trader' = ANY(COALESCE(current_badges, '{}'))) THEN
    UPDATE profiles SET
      badges = array_append(COALESCE(badges, '{}'), 'Verified Trader'),
      -- Only set legacy badge if they have no higher badge
      badge = CASE
        WHEN get_primary_badge(COALESCE(badges, '{}')) IS NULL THEN 'Verified Trader'
        ELSE badge
      END
    WHERE id = target_seller_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_verified_on_review ON reviews;
CREATE TRIGGER auto_verified_on_review
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION check_auto_verified();

-- 6. Update rate limit checks to use get_primary_badge(badges)
CREATE OR REPLACE FUNCTION check_listing_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_badges         text[];
  primary_badge       text;
  is_staff            boolean;
  is_vip              boolean;
  is_verified         boolean;
  daily_limit         integer;
  cooldown_minutes    integer;
  recent_count_cool   integer;
  recent_count_day    integer;
BEGIN
  SELECT COALESCE(badges, CASE WHEN badge IS NOT NULL THEN ARRAY[badge] ELSE '{}' END)
  INTO user_badges FROM profiles WHERE id = NEW.user_id;

  primary_badge := get_primary_badge(user_badges);
  is_staff    := primary_badge IN ('Owner', 'Moderator');
  is_vip      := primary_badge = 'VIP';
  is_verified := primary_badge = 'Verified Trader';

  IF is_staff THEN RETURN NEW; END IF;

  IF is_vip THEN
    daily_limit := 10; cooldown_minutes := 0;
  ELSIF is_verified THEN
    daily_limit := 5; cooldown_minutes := 15;
  ELSE
    daily_limit := 3; cooldown_minutes := 15;
  END IF;

  IF cooldown_minutes > 0 THEN
    SELECT COUNT(*) INTO recent_count_cool FROM listings
    WHERE user_id = NEW.user_id
      AND created_at > now() - (cooldown_minutes || ' minutes')::interval;
    IF recent_count_cool >= 1 THEN
      RAISE EXCEPTION 'Rate limit: Please wait % minutes before posting another listing.', cooldown_minutes;
    END IF;
  END IF;

  SELECT COUNT(*) INTO recent_count_day FROM listings
  WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours';
  IF recent_count_day >= daily_limit THEN
    RAISE EXCEPTION 'Rate limit: You have reached your % listing limit for today.', daily_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_rate_limit_trigger ON listings;
CREATE TRIGGER listing_rate_limit_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION check_listing_rate_limit();

-- 7. Update expiry trigger to use badges array
CREATE OR REPLACE FUNCTION set_listing_expiry()
RETURNS TRIGGER AS $$
DECLARE
  user_badges text[];
  primary_badge text;
BEGIN
  SELECT COALESCE(badges, CASE WHEN badge IS NOT NULL THEN ARRAY[badge] ELSE '{}' END)
  INTO user_badges FROM profiles WHERE id = NEW.user_id;

  primary_badge := get_primary_badge(user_badges);

  NEW.expires_at := now() + CASE
    WHEN primary_badge IN ('VIP', 'Owner') THEN interval '30 days'
    WHEN primary_badge = 'Verified Trader' THEN interval '14 days'
    ELSE interval '7 days'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_expiry_trigger ON listings;
CREATE TRIGGER listing_expiry_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION set_listing_expiry();

-- 8. RLS: update staff checks to use badges array too
-- (badge column still kept in sync so existing policies still work)

-- VERIFY
SELECT id, username, badge, badges
FROM profiles
WHERE badge IS NOT NULL OR (badges IS NOT NULL AND array_length(badges, 1) > 0)
LIMIT 10;
