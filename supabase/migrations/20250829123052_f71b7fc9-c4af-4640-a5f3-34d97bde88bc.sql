-- Backfill image_key from legacy URLs and update image_url to R2
UPDATE playlists 
SET 
  image_key = REPLACE(
    SUBSTRING(image_url FROM 'images%2F.*$'),
    '%2F', '/'
  ),
  image_url = 'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
              REPLACE(
                SUBSTRING(image_url FROM 'images%2F.*$'),
                '%2F', '/'
              )
WHERE image_key IS NULL 
  AND image_url LIKE '%images%25%2F%';

-- Backfill avatar_key from legacy URLs and update avatar_url to R2  
UPDATE profiles
SET 
  avatar_key = REPLACE(
    SUBSTRING(avatar_url FROM 'images%2F.*$'),
    '%2F', '/'
  ),
  avatar_url = 'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
               REPLACE(
                 SUBSTRING(avatar_url FROM 'images%2F.*$'),
                 '%2F', '/'
               )
WHERE avatar_key IS NULL 
  AND avatar_url LIKE '%images%25%2F%';

-- Handle any remaining playlists with different URL formats
UPDATE playlists 
SET 
  image_key = SUBSTRING(image_url FROM 'images/.*$'),
  image_url = 'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
              SUBSTRING(image_url FROM 'images/.*$')
WHERE image_key IS NULL 
  AND image_url LIKE '%/images/%';

-- Handle any remaining profiles with different URL formats
UPDATE profiles
SET 
  avatar_key = SUBSTRING(avatar_url FROM 'images/.*$'),
  avatar_url = 'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
               SUBSTRING(avatar_url FROM 'images/.*$')
WHERE avatar_key IS NULL 
  AND avatar_url LIKE '%/images/%';