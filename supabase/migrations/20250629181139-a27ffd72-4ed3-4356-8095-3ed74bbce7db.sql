
-- Create tracks table
CREATE TABLE public.tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlists table
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_tracks junction table for many-to-many relationship
CREATE TABLE public.playlist_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

-- Create band_members table
CREATE TABLE public.band_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (for future auth implementation)
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (since auth is disabled)
CREATE POLICY "Allow all operations on tracks" ON public.tracks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on playlists" ON public.playlists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on playlist_tracks" ON public.playlist_tracks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on band_members" ON public.band_members FOR ALL USING (true) WITH CHECK (true);

-- Insert some sample data
INSERT INTO public.tracks (title, artist, duration, file_url) VALUES
  ('Intro Riff v2', 'The Band', '2:34', '#'),
  ('Chorus Harmony', 'The Band', '1:47', '#'),
  ('Bridge Experiment', 'The Band', '3:12', '#'),
  ('Verse Melody', 'The Band', '2:18', '#'),
  ('Guitar Solo Draft', 'The Band', '4:05', '#');

INSERT INTO public.playlists (name) VALUES
  ('New Song Ideas'),
  ('Album Demos'),
  ('Practice Sessions');

-- Link tracks to playlists
INSERT INTO public.playlist_tracks (playlist_id, track_id, position) 
SELECT p.id, t.id, 
  CASE 
    WHEN p.name = 'New Song Ideas' AND t.title IN ('Intro Riff v2', 'Chorus Harmony') THEN 
      CASE WHEN t.title = 'Intro Riff v2' THEN 1 ELSE 2 END
    WHEN p.name = 'Album Demos' AND t.title IN ('Chorus Harmony', 'Bridge Experiment', 'Guitar Solo Draft') THEN
      CASE 
        WHEN t.title = 'Chorus Harmony' THEN 1 
        WHEN t.title = 'Bridge Experiment' THEN 2 
        ELSE 3 
      END
    WHEN p.name = 'Practice Sessions' AND t.title IN ('Verse Melody', 'Guitar Solo Draft') THEN
      CASE WHEN t.title = 'Verse Melody' THEN 1 ELSE 2 END
  END
FROM public.playlists p, public.tracks t
WHERE (p.name = 'New Song Ideas' AND t.title IN ('Intro Riff v2', 'Chorus Harmony'))
   OR (p.name = 'Album Demos' AND t.title IN ('Chorus Harmony', 'Bridge Experiment', 'Guitar Solo Draft'))
   OR (p.name = 'Practice Sessions' AND t.title IN ('Verse Melody', 'Guitar Solo Draft'));

INSERT INTO public.band_members (name, email, role) VALUES
  ('Alex Johnson', 'alex@theband.com', 'Lead Guitarist'),
  ('Sarah Mitchell', 'sarah@theband.com', 'Vocalist'),
  ('Mike Rodriguez', 'mike@theband.com', 'Drummer'),
  ('Emma Chen', 'emma@theband.com', 'Bassist');
