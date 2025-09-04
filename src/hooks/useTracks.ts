import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Track } from "@/types/music";

/** Central place to read the app’s API base (used for resolving signed R2 URLs) */
const APP_API_BASE =
  (import.meta as any)?.env?.VITE_APP_API_BASE ||
  (import.meta as any)?.env?.VITE_TRANSCODE_SERVER_URL ||
  "https://transcode-server.onrender.com";

/**
 * Resolve a temporary playback URL for a track.
 * - If storage_url exists, we just return it.
 * - If storage_type is 'r2' and we have a storage_key, we try to fetch a signed URL from the app API.
 * - Otherwise we fall back to fileUrl (legacy).
 */
export const resolvePlaybackUrl = async (track: Track): Promise<string> => {
  // Prefer already-materialized storage_url
  if (track.storage_url) return track.storage_url;

  // Legacy direct URL fallback
  if (track.fileUrl) return track.fileUrl;

  // Try resolving signed URL for R2 objects
  if (track.storage_type === "r2" && track.storage_key) {
    try {
      const res = await fetch(
        `${APP_API_BASE}/api/resolve-r2-url?key=${encodeURIComponent(track.storage_key)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Failed to resolve R2 URL (${res.status})`);
      const data = await res.json(); // expected: { url: string }
      if (data?.url) return data.url;
    } catch (err) {
      console.warn("resolvePlaybackUrl: R2 resolution failed:", err);
    }
  }

  // Nothing better available
  return "";
};

export const useTracks = () => {
  return useQuery({
    queryKey: ["tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((track) => {
        // Prefer storage_url if present, then legacy file_url (kept for backward compatibility)
        const preferredUrl = track.storage_url || track.file_url || "";

        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          fileUrl: preferredUrl,
          addedAt: new Date(track.created_at),
          source_folder: track.source_folder ?? undefined,
          dropbox_path: track.dropbox_path ?? undefined,
          is_public: track.is_public ?? false,
          play_count: track.play_count ?? 0,
          created_by: track.created_by ?? undefined,
          storage_type: track.storage_type ?? undefined,
          storage_key: track.storage_key ?? undefined,
          storage_url: track.storage_url ?? undefined,
        } as Track;
      });
    },
  });
};

export const useAddTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Accept any combination of legacy (fileUrl) or new storage_* fields
    mutationFn: async (track: Omit<Track, "id" | "addedAt">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const payload = {
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        // keep legacy support (nullable)
        file_url: track.fileUrl ?? null,

        source_folder: track.source_folder ?? null,
        dropbox_path: track.dropbox_path ?? null,
        created_by: user.id,

        // prefer provided storage metadata (R2-first flow)
        storage_type: track.storage_type ?? (track.storage_key ? "r2" : "supabase"),
        storage_key: track.storage_key ?? null,
        storage_url: track.storage_url ?? null,

        is_public: track.is_public ?? false,
      };

      const { data, error } = await supabase
        .from("tracks")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // refresh list
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
};

export const useUpdateTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        duration: string;
        title: string;
        artist: string;
        is_public: boolean;
        play_count: number;
        storage_type: string;
        storage_key: string | null;
        storage_url: string | null;
        file_url: string | null;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("tracks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
};

export const useIncrementPlayCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const { data, error } = await supabase
        .from("tracks")
        .select("play_count")
        .eq("id", trackId)
        .single();

      if (error) throw error;

      const newPlayCount = (data?.play_count ?? 0) + 1;

      const { data: updatedData, error: updateError } = await supabase
        .from("tracks")
        .update({ play_count: newPlayCount })
        .eq("id", trackId)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
};

/**
 * Optional helper hook: fetch a best-effort playback URL for a given track (by id).
 * - Uses the cached "tracks" list and resolves a signed URL if necessary.
 */
export const usePlaybackUrl = (trackId?: string) => {
  return useQuery({
    queryKey: ["playback-url", trackId],
    enabled: !!trackId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .eq("id", trackId)
        .single();

      if (error) throw error;

      const track: Track = {
        id: data.id,
        title: data.title,
        artist: data.artist,
        duration: data.duration,
        fileUrl: data.storage_url || data.file_url || "",
        addedAt: new Date(data.created_at),
        source_folder: data.source_folder ?? undefined,
        dropbox_path: data.dropbox_path ?? undefined,
        is_public: data.is_public ?? false,
        play_count: data.play_count ?? 0,
        created_by: data.created_by ?? undefined,
        storage_type: (data.storage_type as "supabase" | "r2") ?? "r2",
        storage_key: data.storage_key ?? undefined,
        storage_url: data.storage_url ?? undefined,
      };

      return resolvePlaybackUrl(track);
    },
  });
};
