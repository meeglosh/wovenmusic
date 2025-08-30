-- Backfill legacy image URLs to use R2 base URL and extract keys
-- First, update playlists with legacy image_url containing encoded paths
UPDATE playlists 
SET 
  image_key = CASE 
    WHEN image_url ~ 'images%2F' THEN 
      replace(substring(image_url from 'images%2F[^?]*'), '%2F', '/')
    WHEN image_url ~ 'images/' THEN 
      substring(image_url from 'images/[^?]*')
    ELSE image_key
  END,
  image_url = CASE 
    WHEN image_url ~ 'images%2F' THEN 
      'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
      replace(substring(image_url from 'images%2F[^?]*'), '%2F', '/')
    WHEN image_url ~ 'images/' THEN 
      'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
      substring(image_url from 'images/[^?]*')
    WHEN image_key IS NOT NULL THEN
      'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || image_key
    ELSE image_url
  END
WHERE image_url IS NOT NULL OR image_key IS NOT NULL;

-- Update profiles with legacy avatar_url containing encoded paths  
UPDATE profiles 
SET 
  avatar_key = CASE 
    WHEN avatar_url ~ 'images%2F' THEN 
      replace(substring(avatar_url from 'images%2F[^?]*'), '%2F', '/')
    WHEN avatar_url ~ 'images/' THEN 
      substring(avatar_url from 'images/[^?]*')
    ELSE avatar_key
  END,
  avatar_url = CASE 
    WHEN avatar_url ~ 'images%2F' THEN 
      'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
      replace(substring(avatar_url from 'images%2F[^?]*'), '%2F', '/')
    WHEN avatar_url ~ 'images/' THEN 
      'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || 
      substring(avatar_url from 'images/[^?]*')
    WHEN avatar_key IS NOT NULL THEN
      'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || avatar_key
    ELSE avatar_url
  END
WHERE avatar_url IS NOT NULL OR avatar_key IS NOT NULL;