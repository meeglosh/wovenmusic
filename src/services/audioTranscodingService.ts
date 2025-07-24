interface TranscodingCache {
  [key: string]: string; // originalUrl_outputFormat -> transcodedBlobUrl
}

class AudioTranscodingService {
  private cache: TranscodingCache = {};

  async transcodeAudio(audioUrl: string, outputFormat = 'mp3'): Promise<string> {
    console.log('=== TRANSCODING START ===', audioUrl, 'Format:', outputFormat);

    const cacheKey = `${audioUrl}_${outputFormat}`;
    if (this.cache[cacheKey]) {
      console.log('Using cached transcoded audio');
      return this.cache[cacheKey];
    }

    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);

      const blob = await response.blob();
      const formData = new FormData();
      formData.append('audio', blob, this.extractFilename(audioUrl));

      const renderResponse = await fetch(`https://transcode-server.onrender.com/transcode?format=${outputFormat}`, {
        method: 'POST',
        body: formData,
      });

      if (!renderResponse.ok) {
        throw new Error(`Render server transcoding failed: ${renderResponse.statusText}`);
      }

      const json = await renderResponse.json();
      const transcodedUrl = json.publicUrl;

      this.cache[cacheKey] = transcodedUrl;
      console.log('=== TRANSCODING SUCCESS ===', transcodedUrl);
      return transcodedUrl;
    } catch (error) {
      console.error('=== TRANSCODING FAILED ===', error);
      return audioUrl; // Fallback to original URL
    }
  }

  private extractFilename(url: string): string {
    return url.split('/').pop() || `input_${Date.now()}.wav`;
  }

  needsTranscoding(audioUrl: string): boolean {
    const url = audioUrl.toLowerCase();
    return url.includes('.aif') || url.includes('.aiff') || url.includes('.wav');
  }

  clearCache(): void {
    Object.values(this.cache).forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.cache = {};
  }
}

export const audioTranscodingService = new AudioTranscodingService();
