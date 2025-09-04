-- Fix R2 storage keys to match actual filenames in R2
-- Extract the filename from file_url and update storage_key to match

UPDATE tracks 
SET 
  storage_key = CASE 
    WHEN file_url IS NOT NULL AND file_url LIKE '%/%' THEN 
      -- Extract filename from URL path (everything after the last '/')
      substring(file_url from '([^/]+)$')
    ELSE storage_key 
  END,
  -- Clear file_url since we're now using R2 directly
  file_url = NULL,
  -- Set proper storage_url for public files
  storage_url = CASE 
    WHEN is_public = true AND file_url IS NOT NULL AND file_url LIKE '%/%' THEN 
      'https://audio.wovenmusic.app/' || substring(file_url from '([^/]+)$')
    ELSE storage_url
  END,
  updated_at = NOW()
WHERE 
  storage_type = 'r2' 
  AND file_url IS NOT NULL;