import { OptimizedImage } from './OptimizedImage';
import { cn } from '@/lib/utils';

interface PlaylistThumbnailProps {
  imageUrl?: string;
  name: string;
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: {
    dimensions: { width: 96, height: 96 },
    textSize: 'text-lg',
    sizes: '96px',
  },
  md: {
    dimensions: { width: 160, height: 160 },
    textSize: 'text-xl',
    sizes: '(max-width: 640px) 50vw, (max-width: 768px) 33vw, 160px',
  },
  lg: {
    dimensions: { width: 256, height: 256 },
    textSize: 'text-2xl',
    sizes: '(max-width: 640px) 80vw, (max-width: 768px) 50vw, 256px',
  },
};

export const PlaylistThumbnail = ({
  imageUrl,
  name,
  className,
  priority = false,
  size = 'md',
}: PlaylistThumbnailProps) => {
  const config = sizeConfig[size];

  if (!imageUrl) {
    return (
      <div
        className={cn(
          'bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center rounded-lg',
          className
        )}
        style={{ aspectRatio: '1', ...config.dimensions }}
      >
        <div className={cn('font-bold text-muted-foreground/60', config.textSize)}>
          {name.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <OptimizedImage
      src={imageUrl}
      alt={`${name} playlist cover`}
      className={cn('rounded-lg', className)}
      sizes={config.sizes}
      priority={priority}
      width={config.dimensions.width}
      height={config.dimensions.height}
      aspectRatio="1"
    />
  );
};