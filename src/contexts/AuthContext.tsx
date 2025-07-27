
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { CONFIG } from '@/lib/config';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'github' | 'twitter') => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  acceptInvitation: (token: string, password: string, fullName: string) => Promise<{ error: any }>;
  sendMagicLink: (email: string, fullName?: string) => Promise<{ error: any }>;
  setPassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: CONFIG.BASE_URL,
        data: fullName ? { full_name: fullName } : undefined
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithProvider = async (provider: 'google' | 'github' | 'twitter') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: CONFIG.BASE_URL
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const sendMagicLink = async (email: string, fullName?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${CONFIG.BASE_URL}/auth/verify`,
        data: fullName ? { full_name: fullName } : undefined
      }
    });
    return { error };
  };

  const setPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    return { error };
  };

  const acceptInvitation = async (token: string, password: string, fullName: string) => {
    // Log the token for debugging
    console.log('Accepting invitation with token:', token);
    
    // First, let's check if the record exists at all (without filters)
    const { data: rawInvitation, error: rawError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    console.log('Raw invitation query result:', { rawInvitation, rawError });

    if (rawInvitation) {
      console.log('Raw invitation details:', {
        token: rawInvitation.token,
        used_at: rawInvitation.used_at,
        expires_at: rawInvitation.expires_at,
        currentTime: new Date().toISOString(),
        isExpired: new Date(rawInvitation.expires_at) <= new Date(),
        isUsed: rawInvitation.used_at !== null
      });
    }

    // Now get the invitation details with all filters
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('email, role, used_at, expires_at')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    console.log('Filtered invitation query result:', { invitation, inviteError });

    if (inviteError) {
      console.error('Invitation query error:', inviteError);
      return { error: { message: 'Error validating invitation' } };
    }

    if (!invitation) {
      return { error: { message: 'Invalid or expired invitation' } };
    }

    // Sign up the user
    const { data: authData, error } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        emailRedirectTo: CONFIG.BASE_URL,
        data: {
          full_name: fullName,
          invitation_role: invitation.role,
          invitation_token: token
        }
      }
    });

    // If signup was successful, mark invitation as used
    if (!error && authData.user) {
      await supabase
        .from('invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);
    }

    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    acceptInvitation,
    sendMagicLink,
    setPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
