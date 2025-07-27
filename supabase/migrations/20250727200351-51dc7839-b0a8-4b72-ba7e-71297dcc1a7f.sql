-- Create playlist_categories table
CREATE TABLE public.playlist_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_category_links join table
CREATE TABLE public.playlist_category_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.playlist_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, category_id)
);

-- Enable Row Level Security
ALTER TABLE public.playlist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_category_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlist_categories
-- All authenticated users can view categories
CREATE POLICY "All authenticated users can view categories" 
ON public.playlist_categories 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins can create categories
CREATE POLICY "Only admins can create categories" 
ON public.playlist_categories 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin_safe(auth.uid()) = true);

-- Only admins can update categories
CREATE POLICY "Only admins can update categories" 
ON public.playlist_categories 
FOR UPDATE 
TO authenticated
USING (is_admin_safe(auth.uid()) = true)
WITH CHECK (is_admin_safe(auth.uid()) = true);

-- Only admins can delete categories
CREATE POLICY "Only admins can delete categories" 
ON public.playlist_categories 
FOR DELETE 
TO authenticated
USING (is_admin_safe(auth.uid()) = true);

-- RLS Policies for playlist_category_links
-- Users can view category links for playlists they can access
CREATE POLICY "Users can view category links for accessible playlists" 
ON public.playlist_category_links 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_category_links.playlist_id 
    AND (
      p.is_public = true 
      OR p.created_by = auth.uid() 
      OR (
        is_band_member_safe(auth.uid()) = true 
        AND EXISTS (
          SELECT 1 FROM public.profiles pr 
          WHERE pr.id = p.created_by 
          AND pr.is_band_member = true
        )
      )
    )
  )
);

-- Users can add categories to their own playlists, admins can add to any
CREATE POLICY "Users can add categories to their playlists" 
ON public.playlist_category_links 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_category_links.playlist_id 
    AND (p.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

-- Users can remove categories from their own playlists, admins can remove from any
CREATE POLICY "Users can remove categories from their playlists" 
ON public.playlist_category_links 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_category_links.playlist_id 
    AND (p.created_by = auth.uid() OR is_admin_safe(auth.uid()) = true)
  )
);

-- Add trigger for automatic timestamp updates on playlist_categories
CREATE TRIGGER update_playlist_categories_updated_at
  BEFORE UPDATE ON public.playlist_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();