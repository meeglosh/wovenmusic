// src/services/imageFor.ts
import { resolveImageUrl } from "@/services/cdn";

type HasImg = { image_key?: string; image_url?: string };
type HasAvatar = { avatar_key?: string; avatar_url?: string };

export const playlistImageSrc = (p: HasImg) =>
  resolveImageUrl(p.image_url, p.image_key);

export const profileAvatarSrc = (p: HasAvatar) =>
  resolveImageUrl(p.avatar_url, p.avatar_key);
