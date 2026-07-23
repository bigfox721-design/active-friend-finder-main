import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";
import { useAuth } from "./useAuth";
import { useCreateActivityLog } from "./useActivityLog";

export type SaleEntry = {
  id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  sale_date: string;
  reference_no: string | null;
  created_by: string | null;
  created_at: string;
  reversed_at: string | null;
  reversed_by: string | null;
};

export const useSales = (opts?: { date?: string; productId?: string; limit?: number }) => {
  const { branchId } = useBranch();
  const { date, productId, limit = 100 } = opts ?? {};
  return useQuery({
    queryKey: ["sales", branchId, date, productId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("sales_entries")
        .select("*, products!inner(name)")
        .order("sale_date", { ascending: false })
        .limit(limit);
      if (branchId) q = q.eq("branch_id", branchId);
      if (date) q = q.eq("sale_date", date);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data as (SaleEntry & { products: { name: string } })[];
    },
  });
};

export const useRecordSale = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const { user } = useAuth();
  const logActivity = useCreateActivityLog();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      quantity: number;
      sale_date?: string;
      reference_no?: string;
      override_approved_by?: string;
    }) => {
      const { data, error } = await supabase
        .rpc("record_sale", {
          p_product_id: input.product_id,
          p_quantity: input.quantity,
          p_branch_id: branchId!,
          p_sale_date: input.sale_date ?? new Date().toISOString().slice(0, 10),
          p_reference_no: input.reference_no ?? null,
          p_override_approved_by: input.override_approved_by ?? null,
        });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory_logs"] });
      const isOverride = !!input.override_approved_by;
      logActivity.mutate({
        action: isOverride ? "override_granted" : "target_set",
        description: isOverride
          ? `Sale recorded with manager override${input.reference_no ? ` (${input.reference_no})` : ""}`
          : `Sale recorded${input.reference_no ? `: ${input.reference_no}` : ""}`,
        branch_id: branchId,
      });
    },
  });
};

export const useReverseSale = () => {
  const qc = useQueryClient();
  const logActivity = useCreateActivityLog();
  return useMutation({
    mutationFn: async (input: {
      sale_id: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .rpc("reverse_sale", {
          p_sale_id: input.sale_id,
          p_reason: input.reason ?? null,
        });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory_logs"] });
      logActivity.mutate({
        action: "transfer_complete",
        description: "Sale reversed — stock restored",
      });
    },
  });
};
