import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate stable JPEG URLs for Media Session API (car dashboards)
 * Takes a Supabase storage URL and returns JPEG variants for better compatibility
 */
export function generateMediaSessionArtwork(imageUrl: string): Array<{ src: string; sizes: string; type: string }> {
  if (!imageUrl) return [];
  
  // Check if it's a Supabase storage URL
  if (imageUrl.includes('supabase') && imageUrl.includes('storage')) {
    // Generate stable JPEG URLs with explicit format parameter
    // Remove any existing transformation parameters to avoid conflicts
    const baseUrl = imageUrl.split('?')[0];
    
    return [
      {
        src: `${baseUrl}?width=256&height=256&resize=cover&format=jpeg&quality=85`,
        sizes: '256x256',
        type: 'image/jpeg'
      },
      {
        src: `${baseUrl}?width=512&height=512&resize=cover&format=jpeg&quality=85`,
        sizes: '512x512', 
        type: 'image/jpeg'
      }
    ];
  }
  
  // For external URLs, assume they're already JPEG-compatible
  return [
    { src: imageUrl, sizes: '512x512', type: 'image/jpeg' }
  ];
}
