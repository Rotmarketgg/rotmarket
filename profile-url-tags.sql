-- ============================================================
-- RotMarket — Profile URL & Tags
-- Run in Supabase SQL Editor
-- ============================================================

-- Add profile_url column (link to Discord, YouTube, Twitter, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_url text;

-- Add tags column (array of user-selected trading style tags)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index for tag filtering if needed later
CREATE INDEX IF NOT EXISTS profiles_tags_idx ON profiles USING gin(tags);

-- Create avatars bucket policies for listing-images bucket fallback
-- (avatars are stored under avatars/ prefix in listing-images until
-- a dedicated avatars bucket is created)
DROP POLICY IF EXISTS "Users can upload avatars to listing-images" ON storage.objects;
CREATE POLICY "Users can upload avatars to listing-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update avatars in listing-images" ON storage.objects;
CREATE POLICY "Users can update avatars in listing-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- VERIFY
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('profile_url', 'tags');
