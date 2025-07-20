-- First, create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_band_member_safe(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_band_member FROM public.profiles WHERE id = user_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_band_members()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE is_band_member = true);
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Band members can view other band member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Band members can view invitations" ON public.invitations;

-- Create new safe policies for profiles
CREATE POLICY "Band members can view other band member profiles"
ON public.profiles
FOR SELECT 
USING (
  public.is_band_member_safe(auth.uid()) = true
  AND is_band_member = true
);

-- Create new safe policies for invitations
CREATE POLICY "Band members can view invitations"
ON public.invitations
FOR SELECT 
USING (public.is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Users can create invitations"
ON public.invitations
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.is_band_member_safe(auth.uid()) = true
    OR 
    NOT public.has_any_band_members()
  )
);