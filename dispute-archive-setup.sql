-- ============================================================
-- RotMarket — Archive & Dispute System SQL
-- Run in Supabase SQL Editor
-- ============================================================

-- Add archived_by column to messages (stores array of user IDs who archived)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS archived_by uuid[] DEFAULT '{}';

-- Disputes table
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
  status text DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolution text,
  admin_notes text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Users can open a dispute
CREATE POLICY "disputes_insert"
  ON disputes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = opened_by);

-- Users can see their own disputes
CREATE POLICY "disputes_select_own"
  ON disputes FOR SELECT TO authenticated
  USING (auth.uid() = opened_by OR auth.uid() = against_user_id);

-- Staff can see all disputes
CREATE POLICY "disputes_select_staff"
  ON disputes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
    )
  );

-- Staff can update disputes
CREATE POLICY "disputes_update_staff"
  ON disputes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND badge IN ('Owner', 'Moderator')
    )
  );

GRANT SELECT, INSERT ON disputes TO authenticated;
GRANT UPDATE ON disputes TO authenticated;

-- Function to archive a conversation for a user
CREATE OR REPLACE FUNCTION archive_conversation(
  p_listing_id uuid,
  p_other_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET archived_by = CASE
    WHEN p_user_id = ANY(archived_by) THEN archived_by  -- already archived
    ELSE array_append(archived_by, p_user_id)
  END
  WHERE listing_id = p_listing_id
    AND (
      (sender_id = p_user_id AND receiver_id = p_other_user_id)
      OR (sender_id = p_other_user_id AND receiver_id = p_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unarchive a conversation
CREATE OR REPLACE FUNCTION unarchive_conversation(
  p_listing_id uuid,
  p_other_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET archived_by = array_remove(archived_by, p_user_id)
  WHERE listing_id = p_listing_id
    AND (
      (sender_id = p_user_id AND receiver_id = p_other_user_id)
      OR (sender_id = p_other_user_id AND receiver_id = p_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS disputes_opened_by_idx ON disputes(opened_by);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes(status);
CREATE INDEX IF NOT EXISTS disputes_trade_request_idx ON disputes(trade_request_id);

-- Verify
SELECT 'disputes table' as item, COUNT(*) as rows FROM disputes;
SELECT 'archive column' as item, column_name FROM information_schema.columns
WHERE table_name = 'messages' AND column_name = 'archived_by';
