import { useEffect, useRef, useState } from "react";
import { Comment } from "@/types/music";

interface WaveformProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  comments: Comment[];
  onAddComment: (timestampSeconds: number) => void;
  isAuthenticated?: boolean;
}

const Waveform = ({ audioRef, currentTime, duration, onSeek, comments, onAddComment, isAuthenticated = false }: WaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadAudioBuffer = async () => {
      if (!audioRef.current?.src) return;
      
      setIsLoading(true);
      try {
        const audioContext = new AudioContext();
        const response = await fetch(audioRef.current.src);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Empty audio file');
        }
        
        console.log('Attempting to decode audio data, buffer size:', arrayBuffer.byteLength);
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('Audio buffer decoded successfully:', buffer);
        setAudioBuffer(buffer);
      } catch (error) {
        console.error('Failed to load audio buffer:', error);
        // Set audioBuffer to null to trigger fallback waveform
        setAudioBuffer(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudioBuffer();
  }, [audioRef.current?.src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Get the primary color for the waveform
    const computedStyle = getComputedStyle(canvas);
    const primaryColor = computedStyle.getPropertyValue('--primary').trim();
    
    // Convert display-p3 to a usable format or use fallback
    let fillColor;
    if (primaryColor.startsWith('color(display-p3')) {
      // For display-p3 colors, use CSS color-mix for opacity
      fillColor = `color-mix(in srgb, ${primaryColor} 50%, transparent)`;
    } else {
      // For HSL colors, use the slash syntax
      fillColor = `hsl(${primaryColor} / 0.5)`;
    }

    if (audioBuffer) {
      // Draw actual waveform data
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;

      ctx.fillStyle = fillColor;
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
          const datum = data[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
    } else {
      // Draw fallback waveform (placeholder bars)
      const amp = height / 2;
      const barWidth = 2;
      const barSpacing = 4;
      const numBars = Math.floor(width / barSpacing);
      
      ctx.fillStyle = fillColor;
      for (let i = 0; i < numBars; i++) {
        const x = i * barSpacing;
        // Create pseudo-random heights for visual appeal
        const barHeight = (Math.sin(i * 0.1) * 0.3 + Math.cos(i * 0.05) * 0.2 + 0.5) * amp;
        ctx.fillRect(x, amp - barHeight / 2, barWidth, barHeight);
      }
    }

    // Draw progress with transparency
    const progress = duration > 0 ? currentTime / duration : 0;
    const progressX = progress * width;
    
    // Create a semi-transparent overlay for played portion
    let playedColor;
    if (primaryColor.startsWith('color(display-p3')) {
      playedColor = `color-mix(in srgb, ${primaryColor} 30%, transparent)`;
    } else {
      playedColor = `hsl(${primaryColor} / 0.3)`;
    }
    ctx.fillStyle = playedColor;
    ctx.fillRect(0, 0, progressX, height);
    ctx.globalCompositeOperation = 'source-atop';
    
    // Draw the waveform data in the progress area with the primary color but more transparent
    let playedWaveformColor;
    if (primaryColor.startsWith('color(display-p3')) {
      playedWaveformColor = `color-mix(in srgb, ${primaryColor} 60%, transparent)`;
    } else {
      playedWaveformColor = `hsl(${primaryColor} / 0.6)`;
    }
    ctx.fillStyle = playedWaveformColor;
    
    if (audioBuffer) {
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;
      
      for (let i = 0; i < progressX; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
          const datum = data[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
    } else {
      // Draw fallback progress bars
      const amp = height / 2;
      const barWidth = 2;
      const barSpacing = 4;
      
      for (let i = 0; i < progressX; i += barSpacing) {
        const barHeight = (Math.sin(i * 0.1) * 0.3 + Math.cos(i * 0.05) * 0.2 + 0.5) * amp;
        ctx.fillRect(i, amp - barHeight / 2, barWidth, barHeight);
      }
    }
    
    ctx.globalCompositeOperation = 'source-over';

    // Draw comment markers
    comments.forEach(comment => {
      const x = (comment.timestampSeconds / duration) * width;
      ctx.fillStyle = 'hsl(var(--destructive))';
      ctx.fillRect(x - 1, 0, 2, height);
      
      // Small circle at the top
      ctx.beginPath();
      ctx.arc(x, 8, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw playhead (current position indicator)
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.fillRect(progressX - 1, 0, 2, height);
    
    // Draw playhead handle at the top
    ctx.beginPath();
    ctx.arc(progressX, 8, 6, 0, 2 * Math.PI);
    ctx.fillStyle = 'hsl(var(--background))';
    ctx.fill();
    ctx.strokeStyle = 'hsl(var(--foreground))';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [audioBuffer, currentTime, duration, comments]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / canvas.width) * duration;
    
    if (e.shiftKey) {
      // Shift+click to add comment
      onAddComment(clickTime);
    } else {
      // Regular click to seek
      onSeek(clickTime);
    }
  };

  if (isLoading) {
    return (
      <div className="h-32 bg-muted rounded flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading waveform...</div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-muted/50 to-muted rounded-2xl p-6 shadow-inner">
      <canvas
        ref={canvasRef}
        width={1200}
        height={200}
        className="w-full h-40 lg:h-56 bg-background/30 rounded-xl cursor-pointer hover:bg-background/40 transition-colors duration-200"
        onClick={handleClick}
      />
      <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
        Click to seek • {isAuthenticated ? "Shift+click to add comment" : "Login to add comments"}
      </div>
      {!audioBuffer && !isLoading && (
        <div className="absolute top-3 left-3 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
          Placeholder waveform • Audio format may not be supported for visualization
        </div>
      )}
    </div>
  );
};

export default Waveform;