-- Add missing columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Member',
ADD COLUMN IF NOT EXISTS is_band_member BOOLEAN DEFAULT false;

-- Create invitations table for managing band member invites
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for invitations
CREATE POLICY "Band members can view invitations"
ON public.invitations
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_band_member = true
  )
);

CREATE POLICY "Band members can create invitations"
ON public.invitations
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_band_member = true
  )
);

-- Add new policy for band members to view other profiles
CREATE POLICY "Band members can view other band member profiles"
ON public.profiles
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_band_member = true
  )
  AND is_band_member = true
);

-- Update tracks table to use user-based access control
ALTER TABLE public.tracks 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Update playlists to use user-based access control  
ALTER TABLE public.playlists 
ADD COLUMN IF NOT EXISTS created_by_user UUID REFERENCES auth.users(id);