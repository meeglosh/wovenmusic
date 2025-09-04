-- Fix RLS policies for profiles table to enable band member collaboration

-- Drop the overly restrictive existing policy
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

-- Create new policies that allow proper band member visibility

-- 1. Users can always see their own profile
CREATE POLICY "profiles_select_self" 
  ON public.profiles 
  FOR SELECT 
  USING (id = auth.uid());

-- 2. Band members can see other band members' profiles
CREATE POLICY "band_members_can_see_band_members" 
  ON public.profiles 
  FOR SELECT 
  USING (
    is_band_member_safe(auth.uid()) = true 
    AND is_band_member = true
  );

-- 3. Admins can see all profiles
CREATE POLICY "admins_can_see_all_profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (is_admin_safe(auth.uid()) = true);

-- Also update the band_members query to work correctly
-- First drop existing restrictive policies on band_members table
DROP POLICY IF EXISTS "Band members can view other band member records" ON public.band_members;

-- Create better policy for band_members table
CREATE POLICY "Band members and admins can view band member records" 
  ON public.band_members 
  FOR SELECT 
  USING (
    is_band_member_safe(auth.uid()) = true 
    OR is_admin_safe(auth.uid()) = true
  );