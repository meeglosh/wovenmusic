-- Add support for multiple roles and custom roles
-- First, add a roles array column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN roles TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create a table for custom roles
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name)
);

-- Enable RLS on custom_roles
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for custom_roles
CREATE POLICY "Band members can view custom roles" 
ON public.custom_roles 
FOR SELECT 
USING (is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Band members can create custom roles" 
ON public.custom_roles 
FOR INSERT 
WITH CHECK (auth.uid() = created_by AND is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Band members can update custom roles they created" 
ON public.custom_roles 
FOR UPDATE 
USING (auth.uid() = created_by AND is_band_member_safe(auth.uid()) = true);

CREATE POLICY "Band members can delete custom roles they created" 
ON public.custom_roles 
FOR DELETE 
USING (auth.uid() = created_by AND is_band_member_safe(auth.uid()) = true);

-- Add trigger for custom_roles updated_at
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing single role data to roles array
UPDATE public.profiles 
SET roles = CASE 
  WHEN role IS NOT NULL AND role != '' THEN ARRAY[role]
  ELSE ARRAY[]::TEXT[]
END
WHERE roles = ARRAY[]::TEXT[];