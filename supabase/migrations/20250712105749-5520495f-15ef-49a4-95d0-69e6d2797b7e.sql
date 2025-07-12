-- Update the first user to be a band member if no band members exist yet
UPDATE public.profiles 
SET is_band_member = true, role = 'Admin'
WHERE id = (
  SELECT id FROM public.profiles 
  ORDER BY created_at ASC 
  LIMIT 1
) 
AND NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE is_band_member = true
);

-- Update RLS policy to allow any authenticated user to create invitations if they're the first user
DROP POLICY IF EXISTS "Band members can create invitations" ON public.invitations;
CREATE POLICY "Users can create invitations"
ON public.invitations
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_band_member = true
    )
    OR 
    NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE is_band_member = true
    )
  )
);