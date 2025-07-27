import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting send-invitation function...');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasResendKey: !!resendKey
    });
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    if (!resendKey) {
      throw new Error('Missing Resend API key');
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created');
    
    const requestBody = await req.text();
    console.log('Raw request body:', requestBody);
    
    const { email, role, userId }: InviteRequest = JSON.parse(requestBody);
    console.log('Parsed request:', { email, role, userId });

    // Get inviter's profile
    console.log('Getting inviter profile...');
    const { data: inviterProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('Profile error:', profileError);
    }

    // Create invitation in database
    console.log('Creating invitation in database...');
    const { data: invitation, error: inviteError } = await supabaseClient
      .from('invitations')
      .insert({
        email,
        role,
        invited_by: userId
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Invitation error:', inviteError);
      throw inviteError;
    }
    
    console.log('Invitation created:', invitation);

    // Generate invitation URL using environment variable
    const baseUrl = Deno.env.get('BASE_URL') || 'https://wovenmusic.app';
    const inviteUrl = `${baseUrl}/auth?token=${invitation.token}`;
    
    // Send email using Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error('RESEND_API_KEY not found in environment');
      throw new Error('Email service not configured');
    }
    
    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'A band member';
    
    console.log('Attempting to send email...');
    
    const emailResponse = await resend.emails.send({
      from: "Wovenmusic <onboarding@resend.dev>",
      to: [inviterProfile?.email || "meeglosh@gmail.com"], // Temporary: using verified email for testing
      subject: `You're invited to join Wovenmusic as a ${role}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="color: white; font-weight: bold; font-size: 24px;">W</span>
            </div>
            <h1 style="color: #1f2937; margin: 0;">Welcome to Wovenmusic!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
            <h2 style="color: #374151; margin-top: 0;">You've been invited!</h2>
            <p style="color: #6b7280; margin-bottom: 16px;">
              <strong>${inviterName}</strong> has invited you to join their band on Wovenmusic as a <strong>${role}</strong>.
            </p>
            <p style="color: #6b7280;">
              Converge in resonance. Sculpt time from tone. Scatter rhythm into the communal void.
            </p>
          </div>
          
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 14px;">
            <p>This invitation will expire in 7 days.</p>
            <p>If you can't click the button above, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; background: #f3f4f6; padding: 8px; border-radius: 4px; font-family: monospace;">
              ${inviteUrl}
            </p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error('Resend API error:', emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      invitation,
      inviteUrl,
      emailResponse,
      message: 'Invitation sent successfully!'
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