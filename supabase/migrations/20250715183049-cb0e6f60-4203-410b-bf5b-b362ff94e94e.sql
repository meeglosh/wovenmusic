-- Remove any global file size limits and set a higher limit if needed
-- Check current global storage configuration
SELECT 
  name,
  file_size_limit,
  allowed_mime_types,
  avif_autodetection,
  created_at,
  updated_at
FROM storage.buckets 
WHERE name IN ('transcoded-audio', 'audio-files');

-- Set an even higher limit to ensure no conflicts
UPDATE storage.buckets 
SET file_size_limit = 209715200  -- 200MB
WHERE name IN ('transcoded-audio', 'audio-files');