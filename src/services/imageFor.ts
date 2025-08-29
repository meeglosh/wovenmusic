import { resolveImageUrl } from "@/services/cdn";

type HasImg = { image_key?: string | null; image_url?: string | null };
type HasAvatar = { avatar_key?: string | null; avatar_url?: string | null };

export const playlistImageSrc = (p: HasImg) =>
  resolveImageUrl(p?.image_url ?? null, p?.image_key ?? null);

export const profileAvatarSrc = (p: HasAvatar) =>
  resolveImageUrl(p?.avatar_url ?? null, p?.avatar_key ?? null);