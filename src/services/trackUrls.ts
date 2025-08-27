const FN_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "https://woakvdhlpludrttjixxq.functions.supabase.co";

export async function resolveTrackUrl(trackId: string): Promise<string> {
  const res = await fetch(`${FN_URL}/track-url?id=${trackId}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Failed to resolve URL");
  return json.url as string;
}
