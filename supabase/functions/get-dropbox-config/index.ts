
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { data, error } = await Deno.env.get("DROPBOX_APP_KEY");
  
  if (error) {
    return new Response(
      JSON.stringify({ error: "Dropbox configuration not found" }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500 
      }
    );
  }

  return new Response(
    JSON.stringify({ dropbox_app_key: data }),
    { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    }
  );
})
