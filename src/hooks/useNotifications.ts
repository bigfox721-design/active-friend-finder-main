import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";

export type Notification = {
  id: string;
  branch_id: string;
  type: string;
  title: string;
  message: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
};

export const useNotifications = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["notifications", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: 15_000,
  });
};

export const useUnreadCount = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["notifications", branchId, "unread"],
    enabled: !!branchId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 15_000,
  });
};

export const useMarkAsRead = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", branchId] });
      qc.invalidateQueries({ queryKey: ["notifications", branchId, "unread"] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ is_read: true })
        .eq("branch_id", branchId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", branchId] });
      qc.invalidateQueries({ queryKey: ["notifications", branchId, "unread"] });
    },
  });
};
