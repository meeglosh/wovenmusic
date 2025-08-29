-- Create a function to fix R2 object Content-Type metadata for audio files
CREATE OR REPLACE FUNCTION public.get_content_type_for_extension(file_extension text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN file_extension IN ('mp3', 'mpeg') THEN 'audio/mpeg'
    WHEN file_extension = 'm4a' THEN 'audio/mp4'
    WHEN file_extension = 'wav' THEN 'audio/wav'
    WHEN file_extension = 'aac' THEN 'audio/aac'
    WHEN file_extension = 'ogg' THEN 'audio/ogg'
    WHEN file_extension = 'flac' THEN 'audio/flac'
    WHEN file_extension IN ('aif', 'aiff') THEN 'audio/aiff'
    ELSE 'audio/mpeg'
  END;
$$;