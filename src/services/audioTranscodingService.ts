interface TranscodingCache {
  [key: string]: string; // originalUrl -> transcodedBlobUrl
}

class AudioTranscodingService {
  private cache: TranscodingCache = {};

  async transcodeAudio(audioUrl: string, outputFormat = 'mp3'): Promise<string> {
    console.log('=== TRANSCODING START ===', audioUrl);
    
    // Check cache first
    const cacheKey = `${audioUrl}_${outputFormat}`;
    if (this.cache[cacheKey]) {
      console.log('Using cached transcoded audio');
      return this.cache[cacheKey];
    }

    try {
      console.log('Starting Web Audio API transcoding for:', audioUrl);
      
      // Fetch the audio file
      console.log('Fetching audio file...');
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      console.log('Audio file fetched, size:', arrayBuffer.byteLength, 'bytes');

      // Create audio context
      console.log('Creating audio context...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode audio data
      console.log('Decoding audio data...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio decoded successfully, duration:', audioBuffer.duration, 'seconds');

      // Convert to WAV format (which browsers can play natively)
      console.log('Converting to WAV format...');
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      
      // Create blob URL
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const transcodedUrl = URL.createObjectURL(blob);

      // Cache the result
      this.cache[cacheKey] = transcodedUrl;

      console.log('=== TRANSCODING SUCCESS ===');
      return transcodedUrl;
    } catch (error) {
      console.error('=== TRANSCODING FAILED ===', error);
      throw error;
    }
  }

  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Convert audio data
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return buffer;
  }

  needsTranscoding(audioUrl: string): boolean {
    // Only .aif/.aiff files need transcoding - .wav and .mp3 play natively
    const url = audioUrl.toLowerCase();
    return url.includes('.aif') || url.includes('.aiff');
  }

  clearCache(): void {
    // Revoke all blob URLs to free memory
    Object.values(this.cache).forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.cache = {};
  }
}

export const audioTranscodingService = new AudioTranscodingService();