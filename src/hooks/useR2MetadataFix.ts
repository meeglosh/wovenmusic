import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FixResult {
  total: number;
  fixed: number;
  failed: number;
  errors: string[];
}

export const useR2MetadataFix = () => {
  const [isFixing, setIsFixing] = useState(false);
  const { toast } = useToast();

  const fixR2Metadata = async (): Promise<FixResult | null> => {
    setIsFixing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fix-r2-metadata', {
        method: 'POST'
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fix R2 metadata');
      }

      toast({
        title: "Metadata Fix Complete",
        description: `Fixed ${data.results.fixed} out of ${data.results.total} audio files`,
      });

      return data.results;
      
    } catch (error) {
      console.error('R2 metadata fix error:', error);
      toast({
        title: "Metadata Fix Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsFixing(false);
    }
  };

  return {
    fixR2Metadata,
    isFixing
  };
};