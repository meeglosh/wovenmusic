// src/services/imageFor.ts
import { resolveImageUrl } from "@/services/cdn";

type HasImg = { id?: string; image_key?: string; image_url?: string };
type HasAvatar = { id?: string; avatar_key?: string; avatar_url?: string };

export const playlistImageSrc = (p: HasImg) => {
  const direct = resolveImageUrl(p.image_url ?? p.image_key);
  if (direct) return direct;
  return p.id ? `/api/cover-redirect?playlist_id=${encodeURIComponent(p.id)}` : "";
};

export const profileAvatarSrc = (p: HasAvatar) => {
  const direct = resolveImageUrl(p.avatar_url ?? p.avatar_key);
  return direct;
};
