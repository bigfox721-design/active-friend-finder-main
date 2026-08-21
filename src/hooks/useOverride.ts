import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type EditOverride = {
  id: string;
  user_id: string;
  granted_by: string | null;
  product_id: string;
  reason: string | null;
  expires_at: string;
  target_date: string | null;
  created_at: string;
};

export const useEditOverrides = () => {
  return useQuery({
    queryKey: ["edit_overrides"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("edit_overrides")
        .select("*, user:user_id(name), product:product_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useMyActiveOverrides = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["edit_overrides", "active", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("edit_overrides")
        .select("*, product:product_id(name)")
        .eq("user_id", user!.id)
        .gt("expires_at", now);
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useGrantOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      product_id: string;
      reason?: string;
      expires_at: string;
      target_date?: string | null;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("edit_overrides").insert({
        user_id: input.user_id,
        granted_by: user?.id ?? null,
        product_id: input.product_id,
        reason: input.reason ?? null,
        expires_at: input.expires_at,
        target_date: input.target_date ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit_overrides"] });
    },
  });
};

export const useRevokeOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("edit_overrides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit_overrides"] });
    },
  });
};
