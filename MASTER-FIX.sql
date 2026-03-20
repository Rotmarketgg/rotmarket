-- ============================================================
-- RotMarket — MASTER FIX SQL
-- Run this in Supabase SQL Editor
-- Fixes ALL critical bugs found in audit
-- ============================================================

-- ============================================================
-- FIX 1: trade_requests table (used everywhere, never defined)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  offer_message text,
  offer_price numeric(10,2),
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'declined', 'cancelled', 'completed'
  )),
  buyer_confirmed boolean DEFAULT false,
  seller_confirmed boolean DEFAULT false
);

ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_requests_select" ON trade_requests;
DROP POLICY IF EXISTS "trade_requests_insert" ON trade_requests;
DROP POLICY IF EXISTS "trade_requests_update" ON trade_requests;

CREATE POLICY "trade_requests_select"
  ON trade_requests FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "trade_requests_insert"
  ON trade_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "trade_requests_update"
  ON trade_requests FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

GRANT SELECT, INSERT, UPDATE ON trade_requests TO authenticated;

-- Unique index: only one active/pending offer per buyer per listing
DROP INDEX IF EXISTS trade_requests_active_unique;
CREATE UNIQUE INDEX trade_requests_active_unique
  ON trade_requests (listing_id, buyer_id)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS trade_requests_seller_idx ON trade_requests(seller_id);
CREATE INDEX IF NOT EXISTS trade_requests_status_idx ON trade_requests(status);
CREATE INDEX IF NOT EXISTS trade_requests_listing_idx ON trade_requests(listing_id);

-- ============================================================
-- FIX 2: complete_trade RPC (called but never defined)
-- Marks trade complete, increments trade counts, marks listing sold
-- ============================================================
CREATE OR REPLACE FUNCTION complete_trade(request_id uuid)
RETURNS void AS $$
DECLARE
  req trade_requests%rowtype;
BEGIN
  SELECT * INTO req FROM trade_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade request not found';
  END IF;

  -- Mark trade request completed
  UPDATE trade_requests SET status = 'completed' WHERE id = request_id;

  -- Mark listing as sold
  UPDATE listings SET status = 'sold' WHERE id = req.listing_id;

  -- Increment trade count for both parties
  UPDATE profiles SET trade_count = trade_count + 1 WHERE id = req.buyer_id;
  UPDATE profiles SET trade_count = trade_count + 1 WHERE id = req.seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 3: get_email_by_user_id RPC (needed for username login)
-- ============================================================
CREATE OR REPLACE FUNCTION get_email_by_user_id(user_id uuid)
RETURNS text AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- FIX 4: increment_view_count RPC (called on every listing view)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_view_count(listing_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE listings SET views = views + 1 WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 5: soft_delete_listing RPC (called for listing deletion)
-- ============================================================
CREATE OR REPLACE FUNCTION soft_delete_listing(listing_id uuid)
RETURNS void AS $$
BEGIN
  -- Only the owner can delete their listing
  IF NOT EXISTS (
    SELECT 1 FROM listings WHERE id = listing_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this listing';
  END IF;
  UPDATE listings SET status = 'deleted' WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 6: messages RLS - archived_by update
-- Sender also needs to be able to update archived_by
-- ============================================================
DROP POLICY IF EXISTS "Users can mark their messages as read" ON messages;
CREATE POLICY "Users can update messages they sent or received"
  ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- ============================================================
-- FIX 7: messages RLS - staff can read all messages for disputes
-- ============================================================
DROP POLICY IF EXISTS "Staff can view all messages for disputes" ON messages;
CREATE POLICY "Staff can view all messages for disputes"
  ON messages FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
    )
  );

-- ============================================================
-- FIX 8: Enable realtime for trade_requests (needed for
-- offer notification badge in navbar)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trade_requests;

-- ============================================================
-- FIX 9: Block banned users from creating listings at DB level
-- ============================================================
CREATE OR REPLACE FUNCTION check_not_banned()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true) THEN
    RAISE EXCEPTION 'Your account has been suspended.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listings_ban_check ON listings;
CREATE TRIGGER listings_ban_check
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION check_not_banned();

DROP TRIGGER IF EXISTS trade_requests_ban_check ON trade_requests;
CREATE TRIGGER trade_requests_ban_check
  BEFORE INSERT ON trade_requests
  FOR EACH ROW EXECUTE FUNCTION check_not_banned();

DROP TRIGGER IF EXISTS reviews_ban_check ON reviews;
CREATE TRIGGER reviews_ban_check
  BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION check_not_banned();

-- ============================================================
-- FIX 10: FK constraint names for reviews join
-- (fixes "No reviews" display bug on listing page)
-- ============================================================
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_seller_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- FIX 11: archived_by column on messages (if not already added)
-- ============================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS archived_by uuid[] DEFAULT '{}';

-- ============================================================
-- FIX 12: disputes table (if not already added)
-- ============================================================
CREATE TABLE IF NOT EXISTS disputes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  trade_request_id uuid REFERENCES trade_requests(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  opened_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  against_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'item_not_received', 'item_not_as_described', 'payment_not_received',
    'fraud', 'other'
  )),
  details text,
  status text DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'resolved', 'dismissed'
  )),
  resolution text,
  admin_notes text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_insert" ON disputes;
DROP POLICY IF EXISTS "disputes_select_own" ON disputes;
DROP POLICY IF EXISTS "disputes_select_staff" ON disputes;
DROP POLICY IF EXISTS "disputes_update_staff" ON disputes;

CREATE POLICY "disputes_insert" ON disputes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = opened_by);
CREATE POLICY "disputes_select_own" ON disputes FOR SELECT TO authenticated
  USING (auth.uid() = opened_by OR auth.uid() = against_user_id);
CREATE POLICY "disputes_select_staff" ON disputes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND badge IN ('Owner','Moderator')));
CREATE POLICY "disputes_update_staff" ON disputes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND badge IN ('Owner','Moderator')));

GRANT SELECT, INSERT ON disputes TO authenticated;
GRANT UPDATE ON disputes TO authenticated;

-- ============================================================
-- FIX 13: archive/unarchive functions (if not already added)
-- ============================================================
CREATE OR REPLACE FUNCTION archive_conversation(
  p_listing_id uuid, p_other_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET archived_by = CASE
    WHEN p_user_id = ANY(archived_by) THEN archived_by
    ELSE array_append(archived_by, p_user_id)
  END
  WHERE listing_id = p_listing_id
    AND ((sender_id = p_user_id AND receiver_id = p_other_user_id)
      OR (sender_id = p_other_user_id AND receiver_id = p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unarchive_conversation(
  p_listing_id uuid, p_other_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET archived_by = array_remove(archived_by, p_user_id)
  WHERE listing_id = p_listing_id
    AND ((sender_id = p_user_id AND receiver_id = p_other_user_id)
      OR (sender_id = p_other_user_id AND receiver_id = p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ADDITIONAL INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS reviews_reviewer_id_idx ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes(status);
CREATE INDEX IF NOT EXISTS disputes_opened_by_idx ON disputes(opened_by);
CREATE INDEX IF NOT EXISTS messages_archived_by_idx ON messages USING gin(archived_by);

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'trade_requests' as tbl, COUNT(*) FROM trade_requests
UNION ALL SELECT 'disputes', COUNT(*) FROM disputes
UNION ALL SELECT 'reports', COUNT(*) FROM reports;

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
