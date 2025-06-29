
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BandMember } from "@/types/music";

export const useBandMembers = () => {
  return useQuery({
    queryKey: ["bandMembers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_members")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      return data.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role
      })) as BandMember[];
    }
  });
};

export const useAddBandMember = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (member: Omit<BandMember, "id">) => {
      const { data, error } = await supabase
        .from("band_members")
        .insert({
          name: member.name,
          email: member.email,
          role: member.role
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bandMembers"] });
    }
  });
};
