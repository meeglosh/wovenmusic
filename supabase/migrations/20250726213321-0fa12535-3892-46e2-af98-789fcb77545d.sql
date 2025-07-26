-- Set meeglosh@gmail.com as the first admin
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'meeglosh@gmail.com';