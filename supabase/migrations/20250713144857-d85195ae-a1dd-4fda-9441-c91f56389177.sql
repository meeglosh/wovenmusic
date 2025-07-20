-- Fix critical security issue: restrict track access to owners and band members only

-- Drop the problematic policy that allows all authenticated users to see all tracks
DROP POLICY IF EXISTS "Users can view public tracks and their own tracks" ON public.tracks;

-- Create new restrictive policies for tracks
CREATE POLICY "Users can view their own tracks" 
ON public.tracks 
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "Band members can view other band members' tracks" 
ON public.tracks 
FOR SELECT 
USING (
  is_public = true 
  OR created_by = auth.uid()
  OR (
    is_band_member_safe(auth.uid()) = true 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = tracks.created_by 
      AND is_band_member = true
    )
  )
);

-- Update tracks insert policy to set created_by automatically
DROP POLICY IF EXISTS "Authenticated users can insert tracks" ON public.tracks;

CREATE POLICY "Authenticated users can insert their own tracks" 
ON public.tracks 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Update tracks update policy to only allow owners
DROP POLICY IF EXISTS "Authenticated users can update their own tracks" ON public.tracks;

CREATE POLICY "Users can update their own tracks" 
ON public.tracks 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Update tracks delete policy to only allow owners  
DROP POLICY IF EXISTS "Authenticated users can delete tracks" ON public.tracks;

CREATE POLICY "Users can delete their own tracks" 
ON public.tracks 
FOR DELETE 
USING (created_by = auth.uid());

-- Ensure all existing tracks have a created_by value set to prevent access issues
-- This updates tracks without a created_by to be owned by the first band member found
UPDATE public.tracks 
SET created_by = (
  SELECT id FROM public.profiles 
  WHERE is_band_member = true 
  LIMIT 1
)
WHERE created_by IS NULL;