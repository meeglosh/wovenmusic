export interface TranscodeResult {
  publicUrl: string;
  originalFilename?: string;
}

export class ImportTranscodingService {
  async transcodeAndStore(
    audioUrl: string,
    fileName: string,
    outputFormat: 'mp3' | 'aac' | 'alac' = 'mp3',
    retries = 3
  ): Promise<TranscodeResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Starting server-side ${outputFormat.toUpperCase()} transcoding for: ${fileName} (attempt ${attempt}/${retries})`);

        let bitrate = '320k';
        if (outputFormat !== 'alac') {
          try {
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const duration = audioBuffer.duration;

            const estimated320kbpsSize = duration * 320000 / 8;

            if (estimated320kbpsSize > 10 * 1024 * 1024) {
              bitrate = '256k';
              console.log(`Large file detected (${duration.toFixed(1)}s), using 256kbps`);
            } else {
              console.log(`Standard file (${duration.toFixed(1)}s), using 320kbps`);
            }

            audioContext.close();
          } catch (analysisError) {
            console.warn('Could not analyze audio, using default bitrate:', analysisError);
          }
        }

        const res = await fetch('https://transcode-server.onrender.com/api/transcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioUrl,
            fileName,
            outputFormat,
            bitrate,
          }),
        });

        if (!res.ok) throw new Error(`Transcoding server error ${res.status}`);
        const data = await res.json();

        if (!data?.publicUrl) throw new Error('No public URL returned');

        return {
          publicUrl: data.publicUrl,
          originalFilename: data.originalFilename,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error('All transcoding attempts failed');
  }

  needsTranscoding(filePath: string): boolean {
    const ext = filePath.toLowerCase().split('.').pop();
    return ext === 'wav' || ext === 'aif' || ext === 'aiff';
  }
}

export const importTranscodingService = new ImportTranscodingService();
