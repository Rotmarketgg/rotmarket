-- ============================================================
-- RotMarket.gg — Complete Reports & Admin SQL Setup
-- Run this entire block in Supabase SQL Editor
-- ============================================================

-- STEP 1: Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- STEP 2: Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  reporter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN (
    'scam', 'fake_listing', 'inappropriate', 'harassment', 'spam', 'other'
  )),
  details text,
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewed', 'resolved', 'dismissed'
  )),
  admin_notes text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone
);

-- STEP 3: Enable RLS on reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- STEP 4: Reports policies
DROP POLICY IF EXISTS "reports_insert_authenticated" ON reports;
DROP POLICY IF EXISTS "reports_select_own" ON reports;
DROP POLICY IF EXISTS "reports_select_admin" ON reports;
DROP POLICY IF EXISTS "reports_update_admin" ON reports;
DROP POLICY IF EXISTS "reports_select_staff" ON reports;
DROP POLICY IF EXISTS "reports_update_staff" ON reports;

-- Anyone logged in can submit a report
CREATE POLICY "reports_insert_authenticated"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can see their own reports
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- Owner and Moderators can see all reports
CREATE POLICY "reports_select_staff"
  ON reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND badge IN ('Owner', 'Moderator')
    )
  );

-- Owner and Moderators can update reports
CREATE POLICY "reports_update_staff"
  ON reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND badge IN ('Owner', 'Moderator')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON reports TO authenticated;
GRANT UPDATE ON reports TO authenticated;

-- STEP 5: Fix trade_requests unique constraint
ALTER TABLE trade_requests
  DROP CONSTRAINT IF EXISTS trade_requests_listing_id_buyer_id_key;

DROP INDEX IF EXISTS trade_requests_active_unique;

CREATE UNIQUE INDEX trade_requests_active_unique
  ON trade_requests (listing_id, buyer_id)
  WHERE status IN ('pending', 'accepted');

-- STEP 6: Fix the signup trigger to save username from auth metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username'
  )
  ON CONFLICT (id) DO UPDATE
    SET username = COALESCE(profiles.username, EXCLUDED.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- STEP 7: Index for reports performance
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON reports(reported_user_id);

-- STEP 8: Set your badge to Owner
-- Change 'Davari' to your actual username if different
UPDATE profiles SET badge = 'Owner' WHERE username = 'Davari';

-- STEP 9: Verify everything worked
SELECT 'profiles columns' as check, column_name
  FROM information_schema.columns
  WHERE table_name = 'profiles'
  AND column_name IN ('banned', 'ban_reason', 'badge');

SELECT 'reports table' as check, COUNT(*) as row_count FROM reports;

SELECT 'your badge' as check, username, badge
  FROM profiles WHERE badge IS NOT NULL;
