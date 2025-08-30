-- Backfill image_url and avatar_url with R2 URLs for existing keys
update playlists
set image_url = 'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || image_key
where image_key is not null;

update profiles
set avatar_url = 'https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com/' || avatar_key
where avatar_key is not null;