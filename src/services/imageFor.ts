import { resolveImageUrl } from "@/services/cdn";

type WithImage = { image_key?: string | null; image_url?: string | null; };

export function playlistImageSrc(p: WithImage) {
  // Prefer key (clean path); fall back to legacy URL through resolver
  if (p?.image_key) return resolveImageUrl(null, p.image_key);
  return resolveImageUrl(p?.image_url || "");
}