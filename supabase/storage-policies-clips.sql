-- =============================================================
-- Storage RLS policies for the "clips" bucket
-- Run this in Supabase Dashboard → SQL Editor → New query
-- Path format: {user_id}/{video_id}/{filename}.mp4
-- =============================================================

-- Allow authenticated users to read their own clips (first path segment = their user id)
CREATE POLICY "Users can view own clips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to upload clips to their own folder
CREATE POLICY "Users can upload own clips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own clips
CREATE POLICY "Users can update own clips"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own clips
CREATE POLICY "Users can delete own clips"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
