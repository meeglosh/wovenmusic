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
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        setAudioBuffer(buffer);
      } catch (error) {
        console.error('Failed to load audio buffer:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudioBuffer();
  }, [audioRef.current?.src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = 'hsl(var(--muted))';
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

    // Draw progress with transparency
    const progress = duration > 0 ? currentTime / duration : 0;
    const progressX = progress * width;
    
    // Get the primary color and make it transparent
    const computedStyle = getComputedStyle(canvas);
    const primaryColor = computedStyle.getPropertyValue('--primary').trim();
    const [h, s, l] = primaryColor.split(' ').map(v => v.replace('%', ''));
    
    // Create a semi-transparent overlay for played portion
    ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.3)`;
    ctx.fillRect(0, 0, progressX, height);
    ctx.globalCompositeOperation = 'source-atop';
    
    // Draw the waveform data in the progress area with the primary color but more transparent
    ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.6)`;
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
    </div>
  );
};

export default Waveform;