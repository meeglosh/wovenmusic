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
}

// Generate responsive image URLs with mobile-optimized quality
// Use stable URLs for better caching
const generateImageSrcSet = (src: string): string => {
  // If it's already a Supabase storage URL, generate responsive variants
  if (src.includes('supabase') && src.includes('storage')) {
    // Extract the base URL and file path
    const url = new URL(src);
    const pathParts = url.pathname.split('/');
    const bucket = pathParts[pathParts.length - 2];
    const filename = pathParts[pathParts.length - 1];
    const basePath = url.origin + url.pathname.replace(filename, '');
    
    // Generate WebP variants at different sizes with consistent quality for better caching
    // Using fewer variants with stable parameters to improve cache hit rates
    const variants = [
      { size: 256, format: 'webp', quality: 75 },
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
// Use consistent quality settings for better cache performance
const generateImageSources = (src: string) => {
  if (src.includes('supabase') && src.includes('storage')) {
    const webpSrcSet = generateImageSrcSet(src);
    // Use consistent quality for AVIF to improve caching
    const avifSrcSet = generateImageSrcSet(src).replace(/format=webp&quality=75/g, 'format=avif&quality=65');
    
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
  fallback
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

  // Don't re-encode already absolute URLs
  const isAbsolute = /^https?:\/\//i.test(src);
  const finalSrc = isAbsolute ? src : src;

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
            src={finalSrc}
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
            data-debug-src={finalSrc}
          />
        </picture>
      ) : (
        <img
          src={finalSrc}
          alt={alt}
          className={imageClasses}
          loading={priority ? "eager" : loading}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          width={512}
          height={512}
          onLoad={handleImageLoad}
          onError={handleImageError}
          data-debug-src={finalSrc}
        />
      )}
    </div>
  );
};

export default OptimizedImage;