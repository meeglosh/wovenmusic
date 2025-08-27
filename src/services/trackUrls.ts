const FN_URL =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ||
  "https://woakvdhlpludrttjixxq.functions.supabase.co";

const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function resolveTrackUrl(trackId: string): Promise<string> {
  const res = await fetch(`${FN_URL}/track-url?id=${encodeURIComponent(trackId)}`, {
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${API_KEY}`,
    },
  });
  const json = await res.json();
  if (!json?.ok || !json?.url) {
    throw new Error(json?.error || "Failed to resolve URL");
  }
  return json.url as string;
}
