// src/services/imageFor.ts
import { coverUrlForPlaylist } from "@/services/covers";
import { resolveImageUrl } from "@/services/cdn";

type HasPlaylistCovers = {
  // URL fields (new → legacy)
  cover_thumb_url?: string | null;
  thumb_url?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  image_url?: string | null;
  // Key fields (when we only store keys)
  cover_thumb_key?: string | null;
  thumb_key?: string | null;
  cover_key?: string | null;
  image_key?: string | null;
};

type HasImg = { id?: string } & HasPlaylistCovers;
type HasAvatar = { avatar_key?: string | null; avatar_url?: string | null };

export const playlistImageSrc = (p: HasImg | any): string => {
  // No redirects—return a final, embeddable URL (thumb first, then full, then key-based)
  return coverUrlForPlaylist(p) || "";
};

export const profileAvatarSrc = (p: HasAvatar | any): string => {
  // Avatars still come from Supabase/CDN; normalize either URL or key
  return resolveImageUrl(p.avatar_url ?? p.avatar_key) || "";
};
