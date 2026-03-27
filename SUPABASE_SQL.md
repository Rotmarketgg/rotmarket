# RotMarket — Supabase SQL Migrations

Run each block in the Supabase SQL Editor (Database → SQL Editor → New query).

---

## 1. Fix `user_promotions` — permission denied + ambiguous relationship

The two errors stem from:
1. RLS blocking the anon/authenticated role from inserting into `user_promotions`
2. Multiple FK relationships between `user_promotions` and `profiles` (if `granted_by` also FK'd)

Run this to fix both:

```sql
-- 1a. Add RLS policies so Owner/admin_update_profile RPC can insert/update
-- (assumes you use a service-role or SECURITY DEFINER RPC for writes)

-- If the table doesn't exist yet, create it:
CREATE TABLE IF NOT EXISTS user_promotions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('VIP', 'Moderator', 'Verified Trader')),
  granted_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  active        boolean NOT NULL DEFAULT true,
  note          text,
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- 1b. Enable RLS
ALTER TABLE user_promotions ENABLE ROW LEVEL SECURITY;

-- 1c. Allow owners/mods to read all promotions
CREATE POLICY "Admin read promotions" ON user_promotions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (badges @> ARRAY['Owner'] OR badge = 'Owner')
    )
  );

-- 1d. Allow owners to insert/update/delete via SECURITY DEFINER RPC
-- The safest approach: wrap writes in an RPC that bypasses RLS.
-- Add this function:

CREATE OR REPLACE FUNCTION admin_grant_promotion(
  p_user_id    uuid,
  p_role       text,
  p_expires_at timestamptz DEFAULT NULL,
  p_note       text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller_badges text[];
BEGIN
  SELECT COALESCE(badges, ARRAY[badge]) INTO caller_badges
  FROM profiles WHERE id = auth.uid();

  IF NOT ('Owner' = ANY(caller_badges)) THEN
    RAISE EXCEPTION 'Only Owners can grant promotions';
  END IF;

  INSERT INTO user_promotions (user_id, role, granted_by, expires_at, note, active)
  VALUES (p_user_id, p_role, auth.uid(), p_expires_at, p_note, true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_revoke_promotion(p_promo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller_badges text[];
BEGIN
  SELECT COALESCE(badges, ARRAY[badge]) INTO caller_badges
  FROM profiles WHERE id = auth.uid();

  IF NOT ('Owner' = ANY(caller_badges)) THEN
    RAISE EXCEPTION 'Only Owners can revoke promotions';
  END IF;

  UPDATE user_promotions
  SET active = false, revoked_at = now(), revoked_by = auth.uid()
  WHERE id = p_promo_id;
END;
$$;
```

---

## 2. Fix the ambiguous relationship embed error

The error `"more than one relationship was found for 'user_promotions' and 'profiles'"` 
happens because `user_promotions` has **three** FK columns that all reference `profiles`:
`user_id`, `granted_by`, and `revoked_by`.

PostgREST can't auto-detect which one you want when you write `.select('*, profiles(...)')`.
**You must use named relationship hints in the query.**

The updated `loadPromotions()` query in `admin/page.js` already uses:
```js
.select('*, user:profiles!user_promotions_user_id_fkey(id, username, avatar_url, badges)')
```
This pins the join to the `user_id` FK and resolves the ambiguity.

---

## 3. Admin delete user function

```sql
CREATE OR REPLACE FUNCTION admin_delete_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller_badges text[];
BEGIN
  SELECT COALESCE(badges, ARRAY[badge]) INTO caller_badges
  FROM profiles WHERE id = auth.uid();

  IF NOT ('Owner' = ANY(caller_badges)) THEN
    RAISE EXCEPTION 'Only Owners can delete users';
  END IF;

  -- Soft-delete all listings
  UPDATE listings SET status = 'deleted' WHERE user_id = target_id;

  -- Delete the profile row (cascades to related data)
  DELETE FROM profiles WHERE id = target_id;

  -- Delete from auth.users (requires service role — use a webhook or Supabase Edge Function
  -- if you need hard auth deletion. Profile deletion is sufficient for most cases.)
END;
$$;
```

---

## 4. Expose emails to the admin panel (read-only, Owner only)

Supabase's `auth.users` table is not readable from the client by default.
Create a SECURITY DEFINER view:

```sql
CREATE OR REPLACE VIEW admin_users_email AS
SELECT 
  p.id,
  p.username,
  u.email,
  u.created_at AS auth_created_at,
  u.last_sign_in_at,
  u.confirmed_at
FROM profiles p
JOIN auth.users u ON u.id = p.id;

-- Grant to authenticated role so the client can query it
GRANT SELECT ON admin_users_email TO authenticated;

-- Protect with RLS equivalent: wrap in a function
CREATE OR REPLACE FUNCTION admin_get_users_with_email(search_term text DEFAULT NULL)
RETURNS TABLE (
  id uuid, username text, email text, 
  last_sign_in_at timestamptz, confirmed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  caller_badges text[];
BEGIN
  SELECT COALESCE(badges, ARRAY[badge]) INTO caller_badges
  FROM profiles WHERE id = auth.uid();

  IF NOT ('Owner' = ANY(caller_badges)) THEN
    RAISE EXCEPTION 'Only Owners can view email addresses';
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, u.email::text, u.last_sign_in_at, u.confirmed_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.username IS NOT NULL
    AND (search_term IS NULL OR p.username ILIKE '%' || search_term || '%')
  ORDER BY u.created_at DESC
  LIMIT 100;
END;
$$;
```

---

## 5. Moderator panel — RLS for disputes and reports

Moderators should be able to read/update disputes and reports but NOT access the Users, 
Promotions, Reviews, or Listings admin tabs. This is enforced purely in the UI (separate 
`/mod` route), but you can add DB-level policies too:

```sql
-- Allow mods to update disputes
CREATE POLICY "Mod update disputes" ON disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        badges @> ARRAY['Moderator'] OR badge = 'Moderator' OR
        badges @> ARRAY['Owner'] OR badge = 'Owner'
      )
    )
  );

-- Allow mods to update reports  
CREATE POLICY "Mod update reports" ON reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        badges @> ARRAY['Moderator'] OR badge = 'Moderator' OR
        badges @> ARRAY['Owner'] OR badge = 'Owner'
      )
    )
  );
```

