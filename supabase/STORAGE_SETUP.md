# Supabase Storage Setup

Clip generation uploads files to a Storage bucket named **`clips`**. If you see "No clips were successfully generated" and logs show **"Bucket not found"**, create the bucket:

## Create the `clips` bucket

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Storage** in the left sidebar.
3. Click **New bucket**.
4. **Name:** `clips`
5. **Public bucket:** Off (private).
6. Click **Create bucket**.

## Optional: RLS policies for `clips`

So users can only read/write their own clip files (path format: `{user_id}/{video_id}/{filename}.mp4`):

- **Storage** → **Policies** (or click the `clips` bucket → Policies).
- Add policies using the same pattern as your `videos` bucket, with condition:  
  `(auth.uid()::text = (storage.foldername(name))[1])`  
  for SELECT, INSERT, UPDATE, DELETE as needed.

After the `clips` bucket exists, run **Generate Clips** again on a video.
