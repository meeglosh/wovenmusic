-- Create storage bucket for playlist images
INSERT INTO storage.buckets (id, name, public) VALUES ('playlist-images', 'playlist-images', true);

-- Add image_url column to playlists table
ALTER TABLE public.playlists ADD COLUMN image_url TEXT;

-- Create storage policies for playlist images
CREATE POLICY "Playlist images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'playlist-images');

CREATE POLICY "Anyone can upload playlist images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'playlist-images');

CREATE POLICY "Anyone can update playlist images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'playlist-images');

CREATE POLICY "Anyone can delete playlist images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'playlist-images');