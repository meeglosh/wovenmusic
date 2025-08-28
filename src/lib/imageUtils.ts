/**
 * Utility functions for handling image URLs
 */

const CDN_BASE = import.meta.env.VITE_CDN_BASE || '';

/**
 * Converts legacy cdn.wovenmusic.app URLs to use the raw R2 endpoint
 * Also handles URLs that are already using the correct CDN base
 */
export function getImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  // If the URL already uses our CDN base, return as-is
  if (CDN_BASE && url.startsWith(CDN_BASE)) {
    return url;
  }
  
  // If it's a cdn.wovenmusic.app URL, replace with the raw R2 endpoint
  if (url.includes('cdn.wovenmusic.app')) {
    return url.replace('https://cdn.wovenmusic.app', CDN_BASE);
  }
  
  // For any other case, return the URL as-is
  return url;
}