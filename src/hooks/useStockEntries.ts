import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";
import { useCreateActivityLog } from "./useActivityLog";

export type StockEntry = {
  id: string;
  branch_id: string;
  product_id: string | null;
  accessory_id: string | null;
  entry_date: string;
  plan_qty: number;
  actual_complete_qty: number;
  stock_qty: number;
  category: "product" | "accessory";
  created_at: string;
  updated_at: string;
};

export const useStockEntries = (from?: string, to?: string) => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["stock_entries", branchId, from, to],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("stock_entries")
        .select("*")
        .order("entry_date", { ascending: true });
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("entry_date", from);
      if (to) q = q.lte("entry_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data as StockEntry[];
    },
  });
};

export const useUpsertStockEntry = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const logActivity = useCreateActivityLog();
  return useMutation({
    mutationFn: async (input: {
      product_id?: string;
      accessory_id?: string;
      entry_date: string;
      plan_qty: number;
      actual_complete_qty: number;
      stock_qty: number;
      category: "product" | "accessory";
    }) => {
      const { data: existing } = await (supabase as any)
        .from("stock_entries")
        .select("id")
        .eq("branch_id", branchId)
        .eq("entry_date", input.entry_date)
        .eq("product_id", input.product_id ?? null)
        .eq("accessory_id", input.accessory_id ?? null)
        .maybeSingle();

      const payload: Record<string, any> = {
        plan_qty: input.plan_qty,
        actual_complete_qty: input.actual_complete_qty,
        stock_qty: input.stock_qty,
      };

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("stock_entries")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("stock_entries").insert({
          branch_id: branchId,
          product_id: input.product_id ?? null,
          accessory_id: input.accessory_id ?? null,
          entry_date: input.entry_date,
          category: input.category,
          ...payload,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["stock_entries"] });
      const label = input.product_id ? "Product" : "Accessory";
      logActivity.mutate({
        action: "inventory_adjust",
        description: `${label} stock entry for ${input.entry_date}: Plan ${input.plan_qty}, Actual ${input.actual_complete_qty}, Stock ${input.stock_qty}`,
        branch_id: branchId,
      });
    },
  });
};
