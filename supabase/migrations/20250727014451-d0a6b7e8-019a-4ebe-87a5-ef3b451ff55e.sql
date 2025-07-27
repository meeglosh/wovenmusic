-- Add parent_id column to support threaded comments
ALTER TABLE public.playlist_comments 
ADD COLUMN parent_id uuid REFERENCES public.playlist_comments(id) ON DELETE CASCADE;

-- Add index for better performance when querying threaded comments
CREATE INDEX idx_playlist_comments_parent_id ON public.playlist_comments(parent_id);
CREATE INDEX idx_playlist_comments_playlist_parent ON public.playlist_comments(playlist_id, parent_id);