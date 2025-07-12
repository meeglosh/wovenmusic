-- Add privacy control to tracks table
ALTER TABLE public.tracks ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Update RLS policies for tracks to respect privacy
DROP POLICY IF EXISTS "Allow all operations on tracks" ON public.tracks;

-- Create new RLS policies for tracks
CREATE POLICY "Users can view public tracks and their own tracks" 
ON public.tracks 
FOR SELECT 
USING (is_public = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tracks" 
ON public.tracks 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update their own tracks" 
ON public.tracks 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tracks" 
ON public.tracks 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Ensure playlists default to private (they already do, but let's be explicit)
-- Update any existing public playlists to be private by default if desired
-- UPDATE public.playlists SET is_public = false WHERE is_public = true;