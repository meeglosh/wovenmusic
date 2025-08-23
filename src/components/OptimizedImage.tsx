import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
  aspectRatio?: "square" | "auto";
  objectFit?: "cover" | "contain";
  fallback?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLImageElement>) => void;
}

// Generate responsive image URLs with mobile-optimized quality
const generateImageSrcSet = (src: string): string => {
  // If it's already a Supabase storage URL, generate responsive variants
  if (src.includes('supabase') && src.includes('storage')) {
    // Extract the base URL and file path
    const url = new URL(src);
    const pathParts = url.pathname.split('/');
    const bucket = pathParts[pathParts.length - 2];
    const filename = pathParts[pathParts.length - 1];
    const basePath = url.origin + url.pathname.replace(filename, '');
    
    // Generate WebP variants at different sizes with mobile-optimized quality
    const variants = [
      { size: 128, format: 'webp', quality: 65 },
      { size: 256, format: 'webp', quality: 70 },
      { size: 384, format: 'webp', quality: 75 },
      { size: 512, format: 'webp', quality: 75 },
    ];
    
    return variants
      .map(({ size, format, quality }) => 
        `${basePath}${filename}?width=${size}&height=${size}&resize=cover&format=${format}&quality=${quality} ${size}w`
      )
      .join(', ');
  }
  
  // For external URLs, return as-is
  return `${src} 512w`;
};

// Generate image sources for next-gen formats with mobile-optimized fallbacks
const generateImageSources = (src: string) => {
  if (src.includes('supabase') && src.includes('storage')) {
    const webpSrcSet = generateImageSrcSet(src);
    const avifSrcSet = generateImageSrcSet(src).replace(/format=webp&quality=\d+/g, 'format=avif&quality=60');
    
    return [
      { srcSet: avifSrcSet, type: 'image/avif' },
      { srcSet: webpSrcSet, type: 'image/webp' },
    ];
  }
  
  return [];
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  sizes = "(max-width: 640px) 160px, (max-width: 768px) 200px, (max-width: 1024px) 240px, 280px",
  loading = "lazy",
  priority = false,
  aspectRatio = "square",
  objectFit = "cover",
  fallback,
  draggable = false,
  onDragStart
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sources = generateImageSources(src);
  const srcSet = generateImageSrcSet(src);

  const imageClasses = cn(
    "transition-opacity duration-300",
    aspectRatio === "square" && "aspect-square",
    objectFit === "cover" ? "object-cover" : "object-contain",
    objectFit === "contain" && "bg-neutral-900/5 dark:bg-neutral-100/5",
    !imageLoaded && "opacity-0",
    imageLoaded && "opacity-100",
    className
  );

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  if (imageError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className={cn("relative overflow-hidden", aspectRatio === "square" && "aspect-square")}>
      {/* Loading placeholder */}
      {!imageLoaded && (
        <div className={cn(
          "absolute inset-0 animate-pulse bg-muted",
          aspectRatio === "square" && "aspect-square"
        )} />
      )}
      
      {/* Optimized image with responsive sources */}
      {sources.length > 0 ? (
        <picture>
          {sources.map((source, index) => (
            <source
              key={index}
              srcSet={source.srcSet}
              type={source.type}
              sizes={sizes}
            />
          ))}
          <img
            src={src}
            alt={alt}
            className={imageClasses}
            loading={priority ? "eager" : loading}
            decoding="async"
            fetchPriority={priority ? "high" : "low"}
            srcSet={srcSet}
            sizes={sizes}
            width={512}
            height={512}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onDragStart={onDragStart || ((e) => e.preventDefault())}
            draggable={draggable}
            style={{ 
              WebkitUserDrag: draggable ? 'auto' : 'none', 
              userSelect: 'none' 
            } as React.CSSProperties}
          />
        </picture>
      ) : (
        <img
          src={src}
          alt={alt}
          className={imageClasses}
          loading={priority ? "eager" : loading}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          width={512}
          height={512}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onDragStart={onDragStart || ((e) => e.preventDefault())}
          draggable={draggable}
          style={{ 
            WebkitUserDrag: draggable ? 'auto' : 'none', 
            userSelect: 'none' 
          } as React.CSSProperties}
        />
      )}
    </div>
  );
};

export default OptimizedImage;