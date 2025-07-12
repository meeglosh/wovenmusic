import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BandMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export const useBandMembers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["band-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_members")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as BandMember[];
    }
  });

  const addMember = useMutation({
    mutationFn: async (member: { name: string; email: string; role: string }) => {
      const { data, error } = await supabase
        .from("band_members")
        .insert(member)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
    }
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{ name: string; email: string; role: string }> }) => {
      const { data, error } = await supabase
        .from("band_members")
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

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("band_members")
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
    addMember,
    updateMember,
    deleteMember
  };
};