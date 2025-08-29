import { supabase } from "@/integrations/supabase/client";

export async function resolveTrackUrl(trackId: string): Promise<string> {
  // Use GET request with query parameter since that's what the function expects
  const { data, error } = await supabase.functions.invoke(`track-url?id=${encodeURIComponent(trackId)}`, {
    method: 'GET'
  });
  
  if (error) {
    throw new Error(`Failed to resolve track URL: ${error.message}`);
  }
  
  if (!data?.ok || !data?.url) {
    throw new Error(data?.error || "Failed to resolve URL");
  }
  
  return data.url as string;
}
