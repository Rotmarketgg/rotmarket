-- ============================================================
-- RotMarket Rate Limiting SQL
-- Run in Supabase SQL Editor
-- ============================================================
-- These functions check rate limits server-side so they can't
-- be bypassed by disabling JavaScript.
-- ============================================================

-- Rate limit: 1 listing per 15 min, 3/day normal · 5/day verified · 10/day VIP
-- NOTE: listing-expiry-vip.sql contains the authoritative version of this function.
-- This trigger is superseded by that file — run listing-expiry-vip.sql instead.
CREATE OR REPLACE FUNCTION check_listing_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count_minute integer;
  recent_count_day integer;
BEGIN
  -- Check listings in last 1 minute
  SELECT COUNT(*) INTO recent_count_minute
  FROM listings
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 minute';

  IF recent_count_minute >= 1 THEN
    RAISE EXCEPTION 'Rate limit: Please wait 1 minute before posting another listing.';
  END IF;

  -- Check listings in last 24 hours
  SELECT COUNT(*) INTO recent_count_day
  FROM listings
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';

  IF recent_count_day >= 10 THEN
    RAISE EXCEPTION 'Rate limit: You can post a maximum of 10 listings per day.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_rate_limit_trigger ON listings;
CREATE TRIGGER listing_rate_limit_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION check_listing_rate_limit();

-- Rate limit: 1 dispute per hour, 5 per day
CREATE OR REPLACE FUNCTION check_dispute_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_hour integer;
  recent_day integer;
BEGIN
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

-- Rate limit: 1 report per 10 minutes for same target, 20 reports per day total
CREATE OR REPLACE FUNCTION check_report_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  same_user_recent integer;
  daily_count integer;
BEGIN
  -- Prevent spamming reports against the same person
  SELECT COUNT(*) INTO same_user_recent
  FROM reports
  WHERE reporter_id = NEW.reporter_id
    AND reported_user_id = NEW.reported_user_id
    AND created_at > now() - interval '10 minutes';

  IF same_user_recent >= 1 THEN
    RAISE EXCEPTION 'Rate limit: You already reported this user recently. Please wait 10 minutes.';
  END IF;

  -- Total daily cap
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

-- Rate limit: 30 messages per minute per conversation
CREATE OR REPLACE FUNCTION check_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count integer;
BEGIN
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

-- Rate limit: 5 trade offers per hour per buyer
CREATE OR REPLACE FUNCTION check_offer_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Only check on new pending requests (not status updates)
  IF NEW.status != 'pending' THEN
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

-- Verify triggers created
SELECT trigger_name, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%rate_limit%'
ORDER BY event_object_table;
