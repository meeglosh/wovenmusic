-- Create playlist_comments table
CREATE TABLE public.playlist_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.playlist_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for playlist comments
CREATE POLICY "Band members can view playlist comments"
ON public.playlist_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.id = playlist_comments.playlist_id
    AND (
      p.is_public = true 
      OR p.created_by = auth.uid()
      OR (
        is_band_member_safe(auth.uid()) = true 
        AND EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = p.created_by 
          AND profiles.is_band_member = true
        )
      )
    )
  )
);

CREATE POLICY "Band members can create playlist comments"
ON public.playlist_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND is_band_member_safe(auth.uid()) = true
  AND EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.id = playlist_comments.playlist_id
    AND (
      p.is_public = true 
      OR p.created_by = auth.uid()
      OR (
        is_band_member_safe(auth.uid()) = true 
        AND EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = p.created_by 
          AND profiles.is_band_member = true
        )
      )
    )
  )
);

CREATE POLICY "Users can update their own playlist comments"
ON public.playlist_comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlist comments"
ON public.playlist_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_playlist_comments_updated_at
BEFORE UPDATE ON public.playlist_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();