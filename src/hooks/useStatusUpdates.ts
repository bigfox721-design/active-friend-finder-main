import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";

export type StatusUpdate = {
  id: string;
  branch_id: string | null;
  product_id: string | null;
  message: string;
  update_type: "info" | "warning" | "success" | "error" | "transfer" | "process_complete";
  user_id: string | null;
  user_name: string | null;
  created_at: string;
};

export const useStatusUpdates = (limit = 50) => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["status_updates", branchId, limit],
    enabled: !!branchId,
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("status_updates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as StatusUpdate[];
    },
  });
};

export const useCreateStatusUpdate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      branch_id?: string;
      product_id?: string;
      message: string;
      update_type?: StatusUpdate["update_type"];
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("status_updates").insert({
        branch_id: input.branch_id ?? null,
        product_id: input.product_id ?? null,
        message: input.message,
        update_type: input.update_type ?? "info",
        user_id: user?.id ?? null,
        user_name: user?.email?.split("@")[0] ?? "Unknown",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status_updates"] });
    },
  });
};
