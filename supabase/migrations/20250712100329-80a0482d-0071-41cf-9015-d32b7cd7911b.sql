-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Create proper storage policies for audio files
CREATE POLICY "Allow uploads to audio-files bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow viewing audio files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio-files');

CREATE POLICY "Allow updating own audio files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow deleting own audio files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);