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
      console.log('=== LOADING FFMPEG ===');
      this.ffmpeg = new FFmpeg();
      
      // Use jsdelivr with explicit version - most reliable option
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.4/dist/umd';
      
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      console.log('Loading FFmpeg from jsdelivr...');
      
      // Simpler approach - no timeout on individual operations
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('=== FFMPEG READY ===');
    } catch (error) {
      console.error('=== FFMPEG LOAD FAILED ===', error);
      this.isLoaded = false;
      this.ffmpeg = null;
      this.loadPromise = null; // Reset so it can be retried
      throw error;
    }
  }

  async transcodeAudio(audioUrl: string, outputFormat = 'mp3'): Promise<string> {
    console.log('=== TRANSCODING START ===', audioUrl);
    
    // Check cache first
    const cacheKey = `${audioUrl}_${outputFormat}`;
    if (this.cache[cacheKey]) {
      console.log('Using cached transcoded audio');
      return this.cache[cacheKey];
    }

    try {
      console.log('Initializing FFmpeg...');
      await this.initialize();
      if (!this.ffmpeg) throw new Error('FFmpeg not initialized');
      console.log('FFmpeg initialized successfully');

      console.log('Starting audio transcoding for:', audioUrl);
      
      // Fetch the input file
      console.log('Fetching audio file...');
      const inputData = await fetchFile(audioUrl);
      console.log('Audio file fetched, size:', inputData.length, 'bytes');
      
      const inputFileName = 'input.aif';
      const outputFileName = `output.${outputFormat}`;

      // Write input file to FFmpeg filesystem
      console.log('Writing input file to FFmpeg filesystem...');
      await this.ffmpeg.writeFile(inputFileName, inputData);

      // Simple, fast transcoding settings
      const args = [
        '-i', inputFileName,
        '-acodec', 'libmp3lame',
        '-ar', '44100',
        '-b:a', '128k',
        '-ac', '2',
        outputFileName
      ];

      console.log('Starting FFmpeg transcoding with command:', args.join(' '));
      await this.ffmpeg.exec(args);
      console.log('FFmpeg transcoding completed');

      // Read the output file
      console.log('Reading transcoded output...');
      const outputData = await this.ffmpeg.readFile(outputFileName);
      
      // Create blob URL for the transcoded audio
      const blob = new Blob([outputData], { 
        type: 'audio/mpeg'
      });
      const transcodedUrl = URL.createObjectURL(blob);

      // Cache the result
      this.cache[cacheKey] = transcodedUrl;

      // Clean up FFmpeg filesystem
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);

      console.log('=== TRANSCODING SUCCESS ===');
      return transcodedUrl;
    } catch (error) {
      console.error('=== TRANSCODING FAILED ===', error);
      throw error;
    }
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