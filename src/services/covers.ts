// Prefer a thumbnail if present; fall back to the full-size cover.
// Handles a few possible key names so it works with API/DB or local upload responses.
export function coverUrlForPlaylist(p: {
  cover_thumb_url?: string | null;
  coverThumbUrl?: string | null;
  thumb_url?: string | null;
  thumbUrl?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
} | null | undefined) {
  if (!p) return undefined;
  return (
    p.cover_thumb_url ??
    p.coverThumbUrl ??
    p.thumb_url ??
    p.thumbUrl ??
    p.cover_url ??
    p.coverUrl ??
    undefined
  );
}
