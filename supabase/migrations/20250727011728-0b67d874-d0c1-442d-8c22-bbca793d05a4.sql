-- Add foreign key constraints for referential integrity
ALTER TABLE public.playlist_comments
ADD CONSTRAINT fk_playlist
FOREIGN KEY (playlist_id)
REFERENCES public.playlists(id)
ON DELETE CASCADE;

ALTER TABLE public.playlist_comments
ADD CONSTRAINT fk_user
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX idx_playlist_comments_playlist_id ON public.playlist_comments (playlist_id);
CREATE INDEX idx_playlist_comments_created_at ON public.playlist_comments (created_at DESC);