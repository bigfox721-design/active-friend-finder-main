import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";

export type MaterialTransfer = {
  id: string;
  source_branch_id: string | null;
  dest_branch_id: string | null;
  product_id: string | null;
  product_name: string | null;
  raw_material_id: string | null;
  quantity: number;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  notes: string | null;
  requested_by: string | null;
  completed_by: string | null;
  received_at: string | null;
  received_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export const useMaterialTransfers = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["material_transfers", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("material_transfers")
        .select("*, source:source_branch_id(name), dest:dest_branch_id(name)")
        .order("created_at", { ascending: false });
      if (branchId) q = q.or(`source_branch_id.eq.${branchId},dest_branch_id.eq.${branchId}`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useCreateTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      source_branch_id: string;
      dest_branch_id: string;
      product_id: string;
      product_name: string;
      quantity: number;
      notes?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("material_transfers").insert({
        source_branch_id: input.source_branch_id,
        dest_branch_id: input.dest_branch_id,
        product_id: input.product_id,
        product_name: input.product_name,
        quantity: input.quantity,
        notes: input.notes ?? null,
        requested_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_transfers"] });
    },
  });
};

export const useUpdateTransferStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: MaterialTransfer["status"] }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const patch: any = { status: input.status };
      if (input.status === "completed") patch.completed_by = user?.id ?? null;
      const { error } = await (supabase as any)
        .from("material_transfers")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_transfers"] });
    },
  });
};
