-- ============================================================
-- RotMarket — Quantity System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add quantity column to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE listings ADD CONSTRAINT listings_quantity_check CHECK (quantity >= 0);

-- Backfill existing listings to quantity = 1
UPDATE listings SET quantity = 1 WHERE quantity IS NULL;

-- 2. Replace complete_trade with quantity-aware version
-- - Decrements quantity by 1
-- - Only marks listing 'sold' when quantity hits 0
-- - Auto-declines all other pending offers when sold out
CREATE OR REPLACE FUNCTION complete_trade(request_id uuid)
RETURNS void AS $$
DECLARE
  req           trade_requests%rowtype;
  new_quantity  integer;
BEGIN
  SELECT * INTO req FROM trade_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade request not found';
  END IF;

  -- Mark this trade request completed
  UPDATE trade_requests SET status = 'completed' WHERE id = request_id;

  -- Decrement quantity atomically, get new value
  UPDATE listings
  SET
    quantity = quantity - 1,
    status   = CASE WHEN quantity - 1 <= 0 THEN 'sold' ELSE status END
  WHERE id = req.listing_id
  RETURNING quantity INTO new_quantity;

  -- If sold out, decline all remaining pending offers on this listing
  IF new_quantity <= 0 THEN
    UPDATE trade_requests
    SET status = 'declined'
    WHERE listing_id = req.listing_id
      AND id != request_id
      AND status = 'pending';
  END IF;

  -- Increment trade count for both parties
  UPDATE profiles SET trade_count = trade_count + 1 WHERE id = req.buyer_id;
  UPDATE profiles SET trade_count = trade_count + 1 WHERE id = req.seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Index for quantity queries
CREATE INDEX IF NOT EXISTS listings_quantity_idx ON listings(quantity) WHERE status = 'active';

-- VERIFY
SELECT 'quantity column' AS check, COUNT(*) AS rows
FROM information_schema.columns
WHERE table_name = 'listings' AND column_name = 'quantity';
