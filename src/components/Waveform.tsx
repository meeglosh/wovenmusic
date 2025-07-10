import { useEffect, useRef, useState } from "react";
import { Comment } from "@/types/music";

interface WaveformProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  comments: Comment[];
  onAddComment: (timestampSeconds: number) => void;
}

const Waveform = ({ audioRef, currentTime, duration, onSeek, comments, onAddComment }: WaveformProps) => {
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

    // Draw progress
    const progress = duration > 0 ? currentTime / duration : 0;
    const progressX = progress * width;
    
    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.fillRect(0, 0, progressX, height);
    ctx.globalCompositeOperation = 'source-atop';
    
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
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-32 bg-muted rounded cursor-pointer"
        onClick={handleClick}
      />
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        Shift+click to add comment
      </div>
    </div>
  );
};

export default Waveform;