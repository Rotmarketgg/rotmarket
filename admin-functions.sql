-- ============================================================
-- RotMarket Admin Functions SQL - FIXED VERSION
-- Run this in Supabase SQL Editor
-- ============================================================

-- Fix admin_update_profile: empty string "" should clear badge
CREATE OR REPLACE FUNCTION admin_update_profile(
  target_id uuid,
  new_badge text DEFAULT NULL,
  new_banned boolean DEFAULT NULL,
  new_ban_reason text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND badge = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;

  UPDATE profiles SET
    badge = CASE
      WHEN new_badge IS NULL THEN badge
      WHEN new_badge = '' THEN NULL
      ELSE new_badge
    END,
    banned = CASE
      WHEN new_banned IS NULL THEN banned
      ELSE new_banned
    END,
    ban_reason = CASE
      WHEN new_banned IS NULL THEN ban_reason
      WHEN new_banned = false THEN NULL
      ELSE new_ban_reason
    END
  WHERE id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix admin_delete_review with existence check
CREATE OR REPLACE FUNCTION admin_delete_review(review_id uuid)
RETURNS void AS $$
DECLARE
  rev reviews%rowtype;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT * INTO rev FROM reviews WHERE id = review_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  DELETE FROM reviews WHERE id = review_id;

  UPDATE profiles SET
    rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews WHERE seller_id = rev.seller_id
    ), 0),
    review_count = (SELECT COUNT(*) FROM reviews WHERE seller_id = rev.seller_id)
  WHERE id = rev.seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix admin_create_user with proper instance_id
CREATE OR REPLACE FUNCTION admin_create_user(
  user_email text,
  user_password text,
  user_username text
)
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND badge = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE username = user_username) THEN
    RAISE EXCEPTION 'Username already taken: %', user_username;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'Email already in use: %', user_email;
  END IF;

  INSERT INTO auth.users (
    instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data,
    role, aud, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    jsonb_build_object('username', user_username),
    'authenticated', 'authenticated',
    now(), now()
  ) RETURNING id INTO new_user_id;

  INSERT INTO profiles (id, username)
  VALUES (new_user_id, user_username)
  ON CONFLICT (id) DO UPDATE SET username = user_username;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix admin_delete_listing
CREATE OR REPLACE FUNCTION admin_delete_listing(listing_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
  ) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  UPDATE listings SET status = 'deleted' WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE 'admin_%'
ORDER BY routine_name;
