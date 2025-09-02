import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export const useUploadProfileImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const base = supabaseFunctionsBase();
      if (!base) throw new Error("Supabase Functions base URL not configured");
      const endpoint = joinUrl(base, "image-upload");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "profile");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        // Try to extract JSON error; fall back to status text
        let msg = res.statusText;
        try {
          const err = await res.json();
          msg = err?.error || msg;
        } catch {/* ignore */}
        throw new Error(msg || "Upload failed");
      }

      const result = await res.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const useDeleteProfileImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Remove avatar fields on the profile row
      const { data, error } = await supabase
        .from("profiles")
        .update({
          avatar_key: null,
          avatar_url: null,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
