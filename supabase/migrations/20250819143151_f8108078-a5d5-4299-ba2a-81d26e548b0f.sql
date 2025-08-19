-- Add R2 storage columns to tracks table
ALTER TABLE public.tracks 
ADD COLUMN storage_type text DEFAULT 'supabase' CHECK (storage_type IN ('supabase', 'r2')),
ADD COLUMN storage_key text,
ADD COLUMN storage_url text;

-- Update existing tracks to have supabase storage type
UPDATE public.tracks SET storage_type = 'supabase' WHERE storage_type IS NULL;

-- Add index for storage lookup
CREATE INDEX idx_tracks_storage_key ON public.tracks(storage_key) WHERE storage_key IS NOT NULL;