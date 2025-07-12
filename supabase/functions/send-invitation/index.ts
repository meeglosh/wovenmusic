import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: string;
  inviterName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { email, role, inviterName }: InviteRequest = await req.json();

    // Create invitation in database
    const { data: invitation, error: inviteError } = await supabaseClient
      .from('invitations')
      .insert({
        email,
        role,
        invited_by: user.id
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // For now, we'll just return success without sending email
    // TODO: Add Resend integration when RESEND_API_KEY is provided
    console.log(`Invitation created for ${email} with token ${invitation.token}`);
    
    // Generate invitation URL
    const inviteUrl = `${req.headers.get('origin') || 'http://localhost:3000'}/auth?token=${invitation.token}`;
    
    console.log(`Invitation URL: ${inviteUrl}`);

    return new Response(JSON.stringify({ 
      success: true, 
      invitation,
      inviteUrl,
      message: 'Invitation created successfully. Email sending will be available once RESEND_API_KEY is configured.'
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);