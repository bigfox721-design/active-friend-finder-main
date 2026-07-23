import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useClearAllData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("clear_all_data");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
};
