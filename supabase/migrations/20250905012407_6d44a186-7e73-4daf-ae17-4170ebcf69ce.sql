-- Fix the specific track that has incorrect storage_key
-- The actual file is at tracks/fb3dfe48-a610-4796-a31b-b500bfedf979.mp3 but DB has 2d97a005-e129-41e6-a1ba-8079be0ddfd7.mp3
UPDATE tracks 
SET 
  storage_key = 'tracks/fb3dfe48-a610-4796-a31b-b500bfedf979.mp3',
  storage_url = 'r2-private://tracks/fb3dfe48-a610-4796-a31b-b500bfedf979.mp3'
WHERE id = 'fb3dfe48-a610-4796-a31b-b500bfedf979' 
  AND storage_key = '2d97a005-e129-41e6-a1ba-8079be0ddfd7.mp3';

-- Also check for any other tracks that might have similar issues where track ID is in the storage_key but with wrong path
-- This will fix tracks where the filename contains the track ID but is missing the proper path prefix
UPDATE tracks 
SET 
  storage_key = 'tracks/' || storage_key,
  storage_url = 'r2-private://tracks/' || storage_key
WHERE storage_type = 'r2' 
  AND storage_key IS NOT NULL
  AND storage_key NOT LIKE 'tracks/%'
  AND storage_key NOT LIKE '%/%'  -- Skip files that already have path separators
  AND (storage_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' OR storage_key LIKE '%.mp3' OR storage_key LIKE '%.m4a' OR storage_key LIKE '%.wav');