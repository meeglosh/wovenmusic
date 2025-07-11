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
      
      // Use a simple, reliable configuration
      const coreURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js';
      const wasmURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm';
      
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      console.log('Loading FFmpeg core files...');
      
      // Add timeout to FFmpeg loading
      const loadWithTimeout = async (): Promise<void> => {
        console.log('Converting URLs to blobs...');
        const [coreBlobURL, wasmBlobURL] = await Promise.all([
          toBlobURL(coreURL, 'text/javascript'),
          toBlobURL(wasmURL, 'application/wasm')
        ]);
        
        console.log('Loading FFmpeg with blob URLs...');
        await this.ffmpeg!.load({
          coreURL: coreBlobURL,
          wasmURL: wasmBlobURL
        });
      };

      await Promise.race([
        loadWithTimeout(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('FFmpeg initialization timeout after 60 seconds')), 60000)
        )
      ]);

      this.isLoaded = true;
      console.log('=== FFMPEG READY ===');
    } catch (error) {
      console.error('=== FFMPEG LOAD FAILED ===', error);
      this.isLoaded = false;
      this.ffmpeg = null;
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

    // Add timeout wrapper with more granular logging
    const transcodeWithTimeout = async (): Promise<string> => {
      console.log('Initializing FFmpeg...');
      await this.initialize();
      if (!this.ffmpeg) throw new Error('FFmpeg not initialized');
      console.log('FFmpeg initialized successfully');

      console.log('Starting audio transcoding for:', audioUrl);
      
      // Fetch the input file with shorter timeout and better error handling
      console.log('Fetching audio file...');
      const inputData = await Promise.race([
        fetchFile(audioUrl),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('File fetch timeout after 30 seconds')), 30000)
        )
      ]) as Uint8Array;
      
      console.log('Audio file fetched, size:', inputData.length, 'bytes');
      
      const inputFileName = 'input.aif';
      const outputFileName = `output.${outputFormat}`;

      // Write input file to FFmpeg filesystem
      console.log('Writing input file to FFmpeg filesystem...');
      await this.ffmpeg.writeFile(inputFileName, inputData);

      // Optimized transcoding settings for fastest conversion
      const args = [
        '-i', inputFileName,
        '-acodec', 'libmp3lame',  // Always use MP3 for fastest encoding
        '-ar', '44100',           // Standard sample rate
        '-b:a', '96k',            // Even lower bitrate for speed
        '-ac', '2',               // Stereo
        '-preset', 'ultrafast',   // Fastest encoding preset
        '-f', 'mp3',
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

      console.log('Audio transcoding completed successfully');
      return transcodedUrl;
    };

    try {
      // Extended timeout for transcoding process
      return await Promise.race([
        transcodeWithTimeout(),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Transcoding timeout after 180 seconds')), 180000)
        )
      ]);
    } catch (error) {
      console.error('Audio transcoding failed:', error);
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