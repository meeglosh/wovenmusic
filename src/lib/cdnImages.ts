// src/lib/cdnImages.ts
export function getImageUrl(key: string) {
  // Normalize legacy keys and ensure they start with "images/"
  let k = key.trim();
  k = k.replace(/^playlist-images\//, "images/"); // tolerate old prefix
  if (!k.startsWith("images/")) k = `images/${k}`;
  return `https://images.wovenmusic.app/${encodeURIComponent(k)}`;
}
