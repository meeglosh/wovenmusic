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
    const { refresh_token } = await req.json();
    
    const dropboxAppKey = Deno.env.get("DROPBOX_APP_KEY");
    const dropboxAppSecret = Deno.env.get("DROPBOX_APP_SECRET");
    
    console.log("Refreshing Dropbox token...", {
      hasAppKey: !!dropboxAppKey,
      hasAppSecret: !!dropboxAppSecret,
      hasRefreshToken: !!refresh_token
    });
    
    if (!dropboxAppKey || !dropboxAppSecret) {
      return new Response(
        JSON.stringify({ 
          error: "Dropbox credentials not configured. Please add DROPBOX_APP_KEY and DROPBOX_APP_SECRET to your Supabase project secrets." 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500 
        }
      );
    }

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: "Refresh token is required" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: dropboxAppKey,
        client_secret: dropboxAppSecret
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error("Dropbox token refresh failed:", tokenData);
      throw new Error(tokenData.error_description || 'Token refresh failed');
    }

    return new Response(
      JSON.stringify({ 
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refresh_token, // Some providers don't return new refresh token
        expires_in: tokenData.expires_in
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in refresh-dropbox-token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
})