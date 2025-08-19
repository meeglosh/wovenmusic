import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'color';
  placeholderColor?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage = ({
  src,
  alt,
  className,
  sizes = '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw',
  priority = false,
  placeholder = 'color',
  placeholderColor = 'hsl(var(--muted))',
  width,
  height,
  aspectRatio = '1',
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate responsive image URLs for Supabase Storage
  const generateResponsiveSrc = (baseUrl: string) => {
    // Check if it's a Supabase storage URL
    if (baseUrl.includes('supabase.co/storage/v1/object/public/')) {
      const sizes = [128, 256, 384, 512];
      const srcSet = sizes
        .map(size => `${baseUrl}?width=${size}&quality=75&format=webp ${size}w`)
        .join(', ');
      
      return {
        srcSet,
        fallbackSrc: `${baseUrl}?width=256&quality=75&format=webp`,
      };
    }
    
    // For non-Supabase URLs, return as-is
    return {
      srcSet: undefined,
      fallbackSrc: baseUrl,
    };
  };

  const { srcSet, fallbackSrc } = generateResponsiveSrc(src);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  useEffect(() => {
    if (priority && imgRef.current) {
      // Preload the image for above-the-fold content
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = fallbackSrc;
      if (srcSet) {
        link.setAttribute('imagesrcset', srcSet);
        link.setAttribute('imagesizes', sizes);
      }
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, fallbackSrc, srcSet, sizes]);

  if (hasError) {
    return (
      <div
        className={cn(
          'bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center',
          className
        )}
        style={{ aspectRatio, width, height }}
      >
        <div className="text-2xl font-bold text-muted-foreground/60">
          {alt.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-neutral-900', className)}
      style={{ aspectRatio, width, height }}
    >
      {/* Placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: placeholderColor }}
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={fallbackSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className={cn(
          'w-full h-full object-contain transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};