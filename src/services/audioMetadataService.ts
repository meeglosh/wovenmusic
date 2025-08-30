export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

export class AudioMetadataService {
  /**
   * Extract metadata from WAV file using Web Audio API
   */
  async extractWAVMetadata(audioUrl: string): Promise<AudioMetadata> {
    try {
      console.log('Extracting WAV metadata from:', audioUrl);
      
      // Download the audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Use Web Audio API to decode and get duration
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const duration = audioBuffer.duration;
      
      // Close the audio context to free resources
      audioContext.close();
      
      // Try to extract basic metadata from the WAV file headers
      const metadata = this.parseWAVHeaders(arrayBuffer);
      
      return {
        ...metadata,
        duration
      };
    } catch (error) {
      console.warn('Failed to extract WAV metadata:', error);
      return {};
    }
  }

  /**
   * Parse WAV file headers for basic metadata
   * WAV files can contain INFO chunks with metadata
   */
  private parseWAVHeaders(arrayBuffer: ArrayBuffer): Partial<AudioMetadata> {
    try {
      const view = new DataView(arrayBuffer);
      const metadata: Partial<AudioMetadata> = {};
      
      // Check if it's a valid WAV file (RIFF header)
      const riffHeader = String.fromCharCode(
        view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
      );
      
      if (riffHeader !== 'RIFF') {
        return metadata;
      }
      
      // Check WAVE format
      const waveHeader = String.fromCharCode(
        view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
      );
      
      if (waveHeader !== 'WAVE') {
        return metadata;
      }
      
      // Look for INFO chunk (contains metadata)
      let offset = 12;
      while (offset < view.byteLength - 8) {
        const chunkId = String.fromCharCode(
          view.getUint8(offset), view.getUint8(offset + 1),
          view.getUint8(offset + 2), view.getUint8(offset + 3)
        );
        
        const chunkSize = view.getUint32(offset + 4, true); // little endian
        
        if (chunkId === 'LIST') {
          // Check if this is an INFO list
          const listType = String.fromCharCode(
            view.getUint8(offset + 8), view.getUint8(offset + 9),
            view.getUint8(offset + 10), view.getUint8(offset + 11)
          );
          
          if (listType === 'INFO') {
            // Parse INFO subchunks
            const infoMetadata = this.parseINFOChunk(view, offset + 12, chunkSize - 4);
            Object.assign(metadata, infoMetadata);
          }
        }
        
        // Move to next chunk (account for padding)
        offset += 8 + chunkSize + (chunkSize % 2);
      }
      
      return metadata;
    } catch (error) {
      console.warn('Failed to parse WAV headers:', error);
      return {};
    }
  }

  /**
   * Parse INFO chunk for metadata fields
   */
  private parseINFOChunk(view: DataView, startOffset: number, chunkSize: number): Partial<AudioMetadata> {
    const metadata: Partial<AudioMetadata> = {};
    let offset = startOffset;
    const endOffset = startOffset + chunkSize;
    
    while (offset < endOffset - 8) {
      const subChunkId = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      
      const subChunkSize = view.getUint32(offset + 4, true);
      
      if (subChunkSize > 0 && offset + 8 + subChunkSize <= endOffset) {
        const value = this.readStringFromBuffer(view, offset + 8, subChunkSize);
        
        switch (subChunkId) {
          case 'INAM': // Title
            metadata.title = value;
            break;
          case 'IART': // Artist
            metadata.artist = value;
            break;
          case 'IPRD': // Album/Product
            metadata.album = value;
            break;
        }
      }
      
      // Move to next subchunk (account for padding)
      offset += 8 + subChunkSize + (subChunkSize % 2);
    }
    
    return metadata;
  }

  /**
   * Read null-terminated string from buffer
   */
  private readStringFromBuffer(view: DataView, offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const char = view.getUint8(offset + i);
      if (char === 0) break; // null terminator
      result += String.fromCharCode(char);
    }
    return result.trim();
  }

  /**
   * Extract metadata from filename
   * Handles common patterns like "Artist - Title.ext"
   */
  extractMetadataFromFilename(filename: string): Partial<AudioMetadata> {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // Try to parse "Artist - Title" pattern
    const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      return {
        artist: dashMatch[1].trim(),
        title: dashMatch[2].trim()
      };
    }
    
    // Fallback to using filename as title
    return {
      title: nameWithoutExt
    };
  }

  /**
   * Get the best available metadata, combining file metadata and filename parsing
   */
  async getBestMetadata(audioUrl: string, filename: string): Promise<AudioMetadata> {
    const filenameMetadata = this.extractMetadataFromFilename(filename);
    
    // For WAV files, try to extract metadata from the file
    if (filename.toLowerCase().endsWith('.wav')) {
      const fileMetadata = await this.extractWAVMetadata(audioUrl);
      
      // Combine metadata, preferring file metadata over filename parsing
      return {
        title: fileMetadata.title || filenameMetadata.title || filename.replace(/\.[^/.]+$/, ""),
        artist: fileMetadata.artist || filenameMetadata.artist || "Unknown Artist",
        album: fileMetadata.album,
        duration: fileMetadata.duration
      };
    }
    
    // For non-WAV files, use filename parsing only
    return {
      title: filenameMetadata.title || filename.replace(/\.[^/.]+$/, ""),
      artist: filenameMetadata.artist || "Unknown Artist"
    };
  }
}

export const audioMetadataService = new AudioMetadataService();
