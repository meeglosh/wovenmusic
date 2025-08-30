const CDN_BASE =
  import.meta.env.VITE_CDN_BASE ||
  "https://wovenmusic-public.16e03ea92574afdd207c0db88357f095.r2.cloudflarestorage.com";

// Utility to strip leading slashes from paths
function stripLeadingSlash(s: string): string {
  return s.startsWith("/") ? s.slice(1) : s;
}

// Function to resolve image URL, either from legacy or current key
export function resolveImageUrl(legacyUrlOrNull?: string, keyOrNull?: string): string {
  // Preferred: key from DB (e.g. "images/playlists/<uuid>.jpg")
  if (keyOrNull) return `${CDN_BASE}/${stripLeadingSlash(keyOrNull)}`;

  // Legacy URL format handling (either encoded or not)
  if (legacyUrlOrNull) {
    try {
      // Try to decode the legacy URL
      const decoded = decodeURIComponent(legacyUrlOrNull);
      // Match and return the URL for images
      const match = decoded.match(/images\/[a-zA-Z0-9/_\-.]+$/);
      if (match) return `${CDN_BASE}/${match[0]}`;
    } catch (e) {
      // In case decoding fails, log it for debugging (optional)
      console.error("Failed to decode legacy URL:", legacyUrlOrNull, e);
    }

    // If decoding failed, fallback to matching the URL directly
    const match = legacyUrlOrNull.match(/images\/[a-zA-Z0-9/_\-.]+$/);
    if (match) return `${CDN_BASE}/${match[0]}`;
  }

  return ""; // Return empty string if no valid image URL can be determined
}
