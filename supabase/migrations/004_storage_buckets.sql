-- Migration 004: Create storage buckets for images
-- Run this in Supabase SQL Editor

-- Group buy item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-buy-images',
  'group-buy-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- User avatar images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for both buckets
CREATE POLICY "Public read group-buy-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'group-buy-images');

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to group-buy-images
CREATE POLICY "Authenticated upload group-buy-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'group-buy-images'
    AND auth.uid() IS NOT NULL
  );

-- Authenticated users can upload their own avatars
CREATE POLICY "Authenticated upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- Users can update/delete their own avatars (filename starts with their UID)
CREATE POLICY "Users update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
