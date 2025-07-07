
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
    const { code, redirect_uri } = await req.json();
    
    const dropboxAppKey = Deno.env.get("DROPBOX_APP_KEY");
    const dropboxAppSecret = Deno.env.get("DROPBOX_APP_SECRET");
    
    console.log("Checking secrets...", {
      hasAppKey: !!dropboxAppKey,
      hasAppSecret: !!dropboxAppSecret
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

    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: dropboxAppKey,
        client_secret: dropboxAppSecret,
        redirect_uri
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error("Dropbox token exchange failed:", tokenData);
      throw new Error(tokenData.error_description || 'Token exchange failed');
    }

    return new Response(
      JSON.stringify({ access_token: tokenData.access_token }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in exchange-dropbox-token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
})
