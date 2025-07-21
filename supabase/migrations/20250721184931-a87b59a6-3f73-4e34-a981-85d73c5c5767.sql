-- Create table for early access email collection
CREATE TABLE public.early_access_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.early_access_emails ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert their email (for early access requests)
CREATE POLICY "Anyone can submit early access email"
ON public.early_access_emails
FOR INSERT
WITH CHECK (true);

-- Only admins can view early access emails
CREATE POLICY "Admins can view early access emails"
ON public.early_access_emails
FOR SELECT
USING (is_admin_safe(auth.uid()) = true);

-- Add closed beta configuration to profiles table
ALTER TABLE public.profiles
ADD COLUMN closed_beta_enabled BOOLEAN DEFAULT true;