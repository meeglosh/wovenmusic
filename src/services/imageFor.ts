// src/services/imageFor.ts
import { resolveImageUrl } from "@/services/cdn";

type HasImg = { image_key?: string | null; image_url?: string | null };
type HasAvatar = { avatar_key?: string | null; avatar_url?: string | null };

// Prefer the DB key (it's stable and already under images/...), fall back to legacy URL
export const playlistImageSrc = (p: HasImg) =>
  resolveImageUrl(p.image_key ?? p.image_url ?? "");

export const profileAvatarSrc = (p: HasAvatar) =>
  resolveImageUrl(p.avatar_key ?? p.avatar_url ?? "");
