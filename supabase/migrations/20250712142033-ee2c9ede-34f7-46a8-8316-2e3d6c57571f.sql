-- Add play count column to tracks table
ALTER TABLE public.tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0;