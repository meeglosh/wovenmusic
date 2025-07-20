-- Add columns to playlists table for sharing functionality
ALTER TABLE public.playlists 
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN share_token TEXT UNIQUE,
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create playlist_shares table for managing shared access
CREATE TABLE public.playlist_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, email)
);

-- Enable RLS on playlist_shares
ALTER TABLE public.playlist_shares ENABLE ROW LEVEL SECURITY;

-- Create policies for playlist_shares
CREATE POLICY "Users can view shares for playlists they created" 
ON public.playlist_shares 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can create shares for playlists they created" 
ON public.playlist_shares 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete shares for playlists they created" 
ON public.playlist_shares 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists 
    WHERE id = playlist_id AND created_by = auth.uid()
  )
);

-- Update playlists RLS policies to include sharing logic
DROP POLICY IF EXISTS "Allow all operations on playlists" ON public.playlists;

CREATE POLICY "Users can view public playlists or playlists shared with them" 
ON public.playlists 
FOR SELECT 
USING (
  is_public = true 
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.playlist_shares ps
    JOIN auth.users u ON u.email = ps.email
    WHERE ps.playlist_id = id AND u.id = auth.uid()
  )
);

CREATE POLICY "Users can create their own playlists" 
ON public.playlists 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own playlists" 
ON public.playlists 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own playlists" 
ON public.playlists 
FOR DELETE 
USING (created_by = auth.uid());

-- Create trigger for updated_at on playlists
CREATE TRIGGER update_playlists_updated_at
BEFORE UPDATE ON public.playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();