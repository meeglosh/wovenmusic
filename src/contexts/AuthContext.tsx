
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
    // Validate invitation securely via Edge Function (no public table access)
    const { data: validation, error: validationError } = await supabase.functions.invoke('validate-invitation', {
      body: { token }
    });

    if (validationError) {
      return { error: { message: validationError.message || 'Error validating invitation' } };
    }

    if (!validation?.email || !validation?.role) {
      return { error: { message: 'Invalid or expired invitation' } };
    }

    // Sign up the user with validated email and attach invite metadata
    const { data: authData, error } = await supabase.auth.signUp({
      email: validation.email as string,
      password,
      options: {
        emailRedirectTo: `${CONFIG.BASE_URL}/auth`,
        data: {
          full_name: fullName,
          invitation_role: validation.role as string,
          invitation_token: token
        }
      }
    });

    // Attempt to mark invitation as used (best-effort)
    if (!error && authData.user) {
      await supabase.functions.invoke('use-invitation', { body: { token } });
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
