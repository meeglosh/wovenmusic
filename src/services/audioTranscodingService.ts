import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface TranscodingCache {
  [key: string]: string; // originalUrl -> transcodedBlobUrl
}

class AudioTranscodingService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private cache: TranscodingCache = {};

  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadFFmpeg();
    await this.loadPromise;
  }

  private async loadFFmpeg(): Promise<void> {
    try {
      console.log('Initializing FFmpeg...');
      this.ffmpeg = new FFmpeg();
      
      // Load FFmpeg with optimized settings for audio
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
    }
  }

  async transcodeAudio(audioUrl: string, outputFormat = 'mp3'): Promise<string> {
    // Check cache first
    const cacheKey = `${audioUrl}_${outputFormat}`;
    if (this.cache[cacheKey]) {
      console.log('Using cached transcoded audio');
      return this.cache[cacheKey];
    }

    await this.initialize();
    if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

    try {
      console.log('Starting audio transcoding for:', audioUrl);
      
      // Fetch the input file
      const inputData = await fetchFile(audioUrl);
      const inputFileName = 'input.aif';
      const outputFileName = `output.${outputFormat}`;

      // Write input file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, inputData);

      // Transcode with optimized settings for fast conversion
      const args = [
        '-i', inputFileName,
        '-acodec', outputFormat === 'mp3' ? 'libmp3lame' : 'libvorbis',
        '-ar', '44100', // Standard sample rate
        '-b:a', '192k', // Good quality bitrate
        '-f', outputFormat,
        outputFileName
      ];

      console.log('FFmpeg command:', args.join(' '));
      await this.ffmpeg.exec(args);

      // Read the output file
      const outputData = await this.ffmpeg.readFile(outputFileName);
      
      // Create blob URL for the transcoded audio
      const blob = new Blob([outputData], { 
        type: outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/ogg' 
      });
      const transcodedUrl = URL.createObjectURL(blob);

      // Cache the result
      this.cache[cacheKey] = transcodedUrl;

      // Clean up FFmpeg filesystem
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);

      console.log('Audio transcoding completed successfully');
      return transcodedUrl;
    } catch (error) {
      console.error('Audio transcoding failed:', error);
      throw error;
    }
  }

  needsTranscoding(audioUrl: string): boolean {
    // Check if the file extension suggests it needs transcoding
    const url = audioUrl.toLowerCase();
    return url.includes('.aif') || url.includes('.aiff') || 
           url.includes('.flac') || url.includes('.wav');
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