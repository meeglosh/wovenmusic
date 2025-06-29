
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { code, redirect_uri } = await req.json();
  
  const dropboxAppKey = Deno.env.get("DROPBOX_APP_KEY");
  const dropboxAppSecret = Deno.env.get("DROPBOX_APP_SECRET");
  
  if (!dropboxAppKey || !dropboxAppSecret) {
    return new Response(
      JSON.stringify({ error: "Dropbox credentials not configured" }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500 
      }
    );
  }

  try {
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
      throw new Error(tokenData.error_description || 'Token exchange failed');
    }

    return new Response(
      JSON.stringify({ access_token: tokenData.access_token }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
})
