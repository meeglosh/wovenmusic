-- Create a storage bucket for transcoded audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('transcoded-audio', 'transcoded-audio', true);

-- Create policies for the transcoded audio bucket
CREATE POLICY "Transcoded audio files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'transcoded-audio');

CREATE POLICY "System can upload transcoded audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'transcoded-audio');

CREATE POLICY "System can update transcoded audio files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'transcoded-audio');

CREATE POLICY "System can delete transcoded audio files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'transcoded-audio');