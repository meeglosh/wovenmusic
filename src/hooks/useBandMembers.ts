import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  roles: string[];
  is_band_member: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomRole {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export const useBandMembers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["band-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_band_member", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as UserProfile[];
    }
  });

  const inviteUser = useMutation({
    mutationFn: async (invitation: { email: string; role: string }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Call the edge function to create invitation and send email
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { 
          ...invitation,
          userId: user.id 
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
    }
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{ full_name: string; bio: string; role: string; roles: string[]; is_band_member: boolean }> }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
    }
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      // Actually delete the profile completely
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
    }
  });

  return {
    ...query,
    inviteUser,
    updateProfile,
    removeMember
  };
};

export const useInvitations = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .is("used_at", null)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Invitation[];
    }
  });

  const deleteInvitation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    }
  });

  return {
    ...query,
    deleteInvitation
  };
};

export const useCustomRoles = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as CustomRole[];
    }
  });

  const createRole = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from("custom_roles")
        .insert({
          name,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
    }
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
    }
  });

  return {
    ...query,
    createRole,
    deleteRole
  };
};