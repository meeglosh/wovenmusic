export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  async transcodeAndStore(
    audioUrl: string,
    fileName: string,
    outputFormat: 'mp3' | 'aac' = 'mp3',
    retries = 3
  ): Promise<TranscodeResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Starting server-side ${outputFormat.toUpperCase()} transcoding for: ${fileName} (attempt ${attempt}/${retries})`);

        // Estimate duration and determine optimal bitrate
        let bitrate = '320k'; // Default to high quality for AAC/MP3

        try {
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const duration = audioBuffer.duration;

          const estimated320kbpsSize = duration * 320000 / 8;

          if (estimated320kbpsSize > 10 * 1024 * 1024) {
            bitrate = '256k';
            console.log(`Large file detected (${duration.toFixed(1)}s), using 256kbps for compression`);
          } else {
            console.log(`Standard file (${duration.toFixed(1)}s), using 320kbps for high quality`);
          }

          audioContext.close();
        } catch (analysisError) {
          console.warn('Could not analyze audio for bitrate selection, using default 320kbps:', analysisError);
        }

        // Use Render transcoding server instead of Supabase
        console.log('Sending transcoding request to Render server:', {
          audioUrl,
          fileName,
          bitrate,
          outputFormat,
          attempt
        });

        const res = await fetch('https://transcode-server.onrender.com/api/transcode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioUrl,
            fileName,
            bitrate,
            outputFormat,
          }),
        });

        if (!res.ok) {
          throw new Error(`Transcoding server returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (!data?.publicUrl) {
          throw new Error('No public URL returned from transcoding server');
        }

        console.log(`Render server ${outputFormat.toUpperCase()} transcoding complete (${bitrate}):`, data.publicUrl);

        if (data.originalSize && data.transcodedSize) {
          const compressionRatio = ((data.originalSize - data.transcodedSize) / data.originalSize * 100).toFixed(1);
          console.log(`Compression: ${(data.originalSize / 1024 / 1024).toFixed(1)}MB → ${(data.transcodedSize / 1024 / 1024).toFixed(1)}MB (${compressionRatio}% reduction)`);
        }

        if (data.originalFilename) {
          console.log(`Original filename preserved by transcoding service: ${data.originalFilename}`);
        }

        return {
          publicUrl: data.publicUrl,
          originalFilename: data.originalFilename,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Transcoding attempt ${attempt}/${retries} failed for ${fileName}:`, lastError.message);

        if (attempt < retries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Retrying transcoding in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error(`All ${retries} transcoding attempts failed for ${fileName}`);
    throw lastError || new Error('Transcoding failed after all retry attempts');
  }

  needsTranscoding(filePath: string): boolean {
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();
