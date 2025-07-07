
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dropboxAppKey = Deno.env.get("DROPBOX_APP_KEY");
    
    console.log("Checking for DROPBOX_APP_KEY...", dropboxAppKey ? "Found" : "Not found");
    
    if (!dropboxAppKey) {
      return new Response(
        JSON.stringify({ 
          error: "Dropbox app key not configured in Supabase secrets. Please add DROPBOX_APP_KEY to your project secrets." 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500 
        }
      );
    }

    return new Response(
      JSON.stringify({ dropbox_app_key: dropboxAppKey }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in get-dropbox-config:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
})
