-- Add image_key column to playlists table
ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS image_key TEXT;

-- Add avatar_key column to profiles table for consistency
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_key TEXT;