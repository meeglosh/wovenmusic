-- A) For legacy URLs that contain encoded %2F
UPDATE playlists
SET image_key = replace(substring(image_url from 'images%2F.*$'), '%2F', '/')
WHERE image_key IS NULL
  AND image_url LIKE '%images%25%2F%';

-- B) For plain /images/... URLs
UPDATE playlists
SET image_key = substring(image_url from 'images/.*$')
WHERE image_key IS NULL
  AND image_url LIKE '%/images/%';