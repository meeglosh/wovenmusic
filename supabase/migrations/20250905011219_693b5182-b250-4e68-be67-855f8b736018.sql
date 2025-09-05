-- Fix existing R2 tracks with null storage_url by setting a placeholder that track-url can handle
UPDATE tracks 
SET storage_url = 'r2-private://' || storage_key
WHERE storage_type = 'r2' 
  AND storage_url IS NULL 
  AND storage_key IS NOT NULL 
  AND is_public = false;

-- Fix existing R2 public tracks with null storage_url 
UPDATE tracks 
SET storage_url = 'r2-public://' || storage_key
WHERE storage_type = 'r2' 
  AND storage_url IS NULL 
  AND storage_key IS NOT NULL 
  AND is_public = true;