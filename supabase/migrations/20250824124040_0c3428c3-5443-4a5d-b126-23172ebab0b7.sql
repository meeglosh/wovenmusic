-- Add nullable artist_name column to playlists table
ALTER TABLE playlists 
ADD COLUMN IF NOT EXISTS artist_name text;

-- Add index for faster search on artist names
CREATE INDEX IF NOT EXISTS idx_playlists_artist_name 
ON playlists (artist_name);