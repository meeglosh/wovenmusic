-- Increase file size limit for audio storage buckets to 100MB
UPDATE storage.buckets 
SET file_size_limit = 104857600 
WHERE name IN ('transcoded-audio', 'audio-files');