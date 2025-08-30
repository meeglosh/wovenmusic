-- Enable password strength and leaked password protection
UPDATE auth.config 
SET 
  password_strength_enabled = true,
  password_check_breach = true
WHERE id = '1';