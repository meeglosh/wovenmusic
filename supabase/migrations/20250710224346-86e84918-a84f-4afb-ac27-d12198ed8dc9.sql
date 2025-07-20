-- Add source_folder and dropbox_path columns to tracks table
ALTER TABLE public.tracks 
ADD COLUMN source_folder TEXT,
ADD COLUMN dropbox_path TEXT;

-- Update existing tracks to use the woven sketches folder as default
UPDATE public.tracks 
SET source_folder = '/woven - sketches 24' 
WHERE source_folder IS NULL;