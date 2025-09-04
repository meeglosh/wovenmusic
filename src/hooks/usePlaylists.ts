import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Playlist } from "@/types/music";
import { playlistImageSrc } from "@/services/imageFor";
import { coverUrlForPlaylist } from "@/services/covers";
import { CONFIG, joinUrl } from "@/lib/config";

function supabaseFunctionsBase(): string {
  // Build https://<project-ref>.functions.supabase.co from VITE_SUPABASE_URL
  try {
    const host = new URL(CONFIG.SUPABASE_URL).host; // <ref>.supabase.co
    const ref = host.split(".")[0];
    return `https://${ref}.functions.supabase.co`;
  } catch {
    return "";
  }
}

// Small helper to add/refresh a cache-busting param
function bust(u?: string | null): string | undefined {
  if (!u) return u ?? undefined;
  const v = Date.now();
  return u.includes("?") ? `${u}&v=${v}` : `${u}?v=${v}`;
}

// Be polite on transient 429s from Cloudflare
async function fetchWith429Retry(url: string, init: RequestInit, max = 3) {
  for (let attempt = 0; attempt < max; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    const retryAfter = res.headers.get("Retry-After");
    const waitMs =
      retryAfter ? Number(retryAfter) * 1000 :
      Math.min(1500, 250 * 2 ** attempt) + Math.floor(Math.random() * 150);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  // final try
  return fetch(url, init);
}

export const usePlaylists = () => {
  return useQuery({
    queryKey: ["playlists"],
    // keep from hammering APIs when focusing the tab
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select(
          `
          *,
          playlist_tracks (
            track_id,
            position
          ),
          playlist_shares (
            email
          )
        `.trim()
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get all unique creator IDs
      const creatorIds = [...new Set(data.map((p) => p.created_by).filter(Boolean))];

      // Fetch creator profiles
      let creatorProfiles: any[] = [];
      if (creatorIds.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        if (!profErr) creatorProfiles = profiles || [];
      }

      // Map rows to app Playlist objects.
      // NOTE: We compute imageUrl using the *row* so coverUrlForPlaylist can
      // see updated_at/image fields and append a v= cache-buster.
      return data.map((row) => {
        const image = coverUrlForPlaylist(row) ?? playlistImageSrc(row);
        return {
          id: row.id,
          name: row.name,
          artistName: row.artist_name,
          imageUrl: image,
          trackIds: (row.playlist_tracks || [])
            .slice()
            .sort((a: any, b: any) => a.position - b.position)
            .map((pt: any) => pt.track_id),
          createdAt: new Date(row.created_at),
          sharedWith: row.playlist_shares?.map((share: any) => share.email) || [],
          isPublic: row.is_public,
          shareToken: row.share_token,
          created_by: row.created_by,
          createdByName:
            creatorProfiles.find((p) => p.id === row.created_by)?.full_name || "Unknown User",
        } as Playlist;
      });
    },
  });
};

export const useCreatePlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, artistName }: { name: string; artistName?: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("playlists")
        .insert({
          name,
          artist_name: artistName?.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useAddTrackToPlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      // Get current max position
      const { data: existingTracks, error: posErr } = await supabase
        .from("playlist_tracks")
        .select("position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1);

      if (posErr) throw posErr;

      const nextPosition = existingTracks?.length ? existingTracks[0].position + 1 : 0;

      const { data, error } = await supabase
        .from("playlist_tracks")
        .insert({
          playlist_id: playlistId,
          track_id: trackId,
          position: nextPosition,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useReorderPlaylistTracks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackIds }: { playlistId: string; trackIds: string[] }) => {
      // Update positions for all tracks in the playlist
      const updates = trackIds.map((trackId, index) => ({
        playlist_id: playlistId,
        track_id: trackId,
        position: index,
      }));

      // First, delete all existing tracks for this playlist
      const { error: delErr } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId);
      if (delErr) throw delErr;

      // Then insert them in the new order
      const { data, error } = await supabase.from("playlist_tracks").insert(updates).select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useRemoveTrackFromPlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      const { error } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.refetchQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useUpdatePlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      imageUrl,
      artistName,
    }: {
      id: string;
      name?: string;
      imageUrl?: string;
      artistName?: string | null;
    }) => {
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (imageUrl !== undefined) updateData.image_url = imageUrl;
      if (artistName !== undefined) updateData.artist_name = artistName;

      const { data, error } = await supabase
        .from("playlists")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useDeletePlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playlistId: string) => {
      // Delete playlist tracks first (cascade may handle, but explicit is fine)
      const { error: delTracksErr } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId);
      if (delTracksErr) throw delTracksErr;

      // Delete the playlist
      const { error } = await supabase.from("playlists").delete().eq("id", playlistId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};

export const useUploadPlaylistImage = () => {
  const queryClient = useQueryClient();

  // Prefer same-origin Pages Function. Works in production Pages without any env var.
  const pagesUploadUrl = (): string => "/api/image-upload";

  // Optional extra base (if you ever want to point the frontend at another domain)
  const appBase =
    (import.meta as any)?.env?.VITE_APP_API_BASE ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const join = (base: string, path: string) =>
    `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

  return useMutation({
    mutationFn: async ({ file, playlistId }: { file: File; playlistId: string }) => {
      // NOTE: keep console noise minimal; repeated logs can look like duplicate calls in the console
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "playlist");
      formData.append("entityId", playlistId);

      // 1) Try same-origin Pages Function
      try {
        const res = await fetchWith429Retry(pagesUploadUrl(), { method: "POST", body: formData });
        if (res.ok) return await res.json();
      } catch (_) { /* ignore, try next */ }

      // 2) Try explicit APP base (if set)
      if (appBase) {
        try {
          const res = await fetchWith429Retry(join(appBase, "/api/image-upload"), {
            method: "POST",
            body: formData,
          });
          if (res.ok) return await res.json();
        } catch (_) { /* ignore, try next */ }
      }

      // 3) Fall back to Supabase Edge Function (requires auth)
      const functionsBase = supabaseFunctionsBase();
      if (functionsBase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const res = await fetch(join(functionsBase, "image-upload"), {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        if (!res.ok) {
          let msg = res.statusText;
          try {
            const err = await res.json();
            msg = err?.error || msg;
          } catch {}
          throw new Error(msg || "Upload failed");
        }
        return res.json();
      }

      throw new Error("No upload endpoint configured");
    },
    onSuccess: (_resp, vars) => {
      // Instant UI refresh: bump the cached image URL for this playlist
      queryClient.setQueryData(["playlists"], (old: unknown) => {
        const arr = Array.isArray(old) ? (old as Playlist[]) : undefined;
        if (!arr) return old;
        return arr.map((p) =>
          p.id === vars.playlistId ? { ...p, imageUrl: bust(p.imageUrl) } : p
        );
      });

      // And revalidate for persistence and other fields (e.g., updated_at)
      queryClient.invalidateQueries({ queryKey: ["playlists"] });

      // Optional: nuke any SW runtime cache for the old URL
      if (typeof window !== "undefined" && "caches" in window) {
        const prev = (queryClient.getQueryData(["playlists"]) as Playlist[] | undefined)
          ?.find((p) => p.id === vars.playlistId)?.imageUrl;
        if (prev) {
          caches.keys().then((keys) =>
            Promise.all(keys.map((k) => caches.open(k).then((c) => c.delete(prev))))
          ).catch(() => {});
        }
      }
    },
  });
};

export const useDeletePlaylistImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playlistId: string) => {
      // Try to clear both main and thumb fields; if schema lacks thumb columns, fall back.
      const attempt = async (payload: Record<string, any>) =>
        supabase
          .from("playlists")
          .update(payload)
          .eq("id", playlistId)
          .select()
          .single();

      let { data, error } = await attempt({
        image_key: null,
        image_url: null,
        cover_thumb_key: null,
        cover_thumb_url: null,
      });

      if (error) {
        // Fallback for older schema without thumb fields
        const res = await attempt({
          image_key: null,
          image_url: null,
        });
        data = res.data;
        if (res.error) throw res.error;
      }

      return data;
    },
    onSuccess: (_data, playlistId) => {
      // Update cached object so UI shows removal immediately
      queryClient.setQueryData(["playlists"], (old: unknown) => {
        const arr = Array.isArray(old) ? (old as Playlist[]) : undefined;
        if (!arr) return old;
        return arr.map((p) =>
          p.id === playlistId ? { ...p, imageUrl: "" } : p
        );
      });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
};
