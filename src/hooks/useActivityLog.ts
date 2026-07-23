import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";

export type ActivityLog = {
  id: string;
  branch_id: string | null;
  product_id: string | null;
  action: string;
  description: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export const useActivityLogs = (limit = 100) => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["activity_logs", branchId, limit],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return data as ActivityLog[];
    },
  });
};

export const useCreateActivityLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      branch_id?: string;
      product_id?: string;
      action: string;
      description: string;
      user_name?: string;
      metadata?: Record<string, any>;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      let userRole = user?.user_metadata?.role as string | undefined;
      if (!userRole && user?.id) {
        const { data: appUser } = await (supabase as any)
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        userRole = appUser?.role ?? null;
      }
      const { error } = await (supabase as any).from("activity_logs").insert({
        branch_id: input.branch_id ?? null,
        product_id: input.product_id ?? null,
        action: input.action,
        description: input.description,
        user_id: user?.id ?? null,
        user_name: input.user_name ?? user?.email?.split("@")[0] ?? "Unknown",
        user_role: userRole ?? null,
        metadata: input.metadata ?? {},
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
};
