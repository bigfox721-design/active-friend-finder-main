import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product, ProductionEntry } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { useBranch } from "./useBranch";

export const useProducts = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["products", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any).from("products").select("*").eq("active", true).order("name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Product[];
    },
  });
};

export const useEntries = (opts?: { from?: string; to?: string }) => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["entries", branchId, opts?.from, opts?.to],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any).from("production_entries").select("*, product:products(*)").order("entry_date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      if (opts?.from) q = q.gte("entry_date", opts.from);
      if (opts?.to) q = q.lte("entry_date", opts.to);
      const { data, error } = await q;
      if (error) throw error;
      return data as (ProductionEntry & { product: Product })[];
    },
  });
};

export const useTodayEntries = () => useEntries({ from: todayISO(), to: todayISO() });

export const useUpsertEntry = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  return useMutation({
    mutationFn: async (input: { product_id: string; entry_date: string; target_qty?: number; completed_qty?: number; notes?: string; manpower?: number }) => {
      // Ensure a matching products row exists (FK requirement). Sub-products live in
      // a separate table; mirror them into products as inactive so they satisfy the FK
      // without polluting the active product list.
      const { data: prodExists } = await (supabase as any)
        .from("products").select("id").eq("id", input.product_id).maybeSingle();
      if (!prodExists) {
        const { data: sub } = await (supabase as any)
          .from("sub_products")
          .select("id, name, code, product_id, product:products(branch_id, unit)")
          .eq("id", input.product_id)
          .maybeSingle();
        if (sub) {
          await (supabase as any).from("products").insert({
            id: sub.id,
            name: sub.name,
            code: sub.code ?? null,
            branch_id: sub.product?.branch_id ?? branchId,
            unit: sub.product?.unit ?? "pcs",
            active: false,
          });
        }
      }

      const { data: existing } = await (supabase as any)
        .from("production_entries")
        .select("*")
        .eq("product_id", input.product_id)
        .eq("entry_date", input.entry_date)
        .maybeSingle();

      if (existing) {
        const patch: any = {};
        if (input.target_qty !== undefined) patch.target_qty = input.target_qty;
        if (input.completed_qty !== undefined) patch.completed_qty = input.completed_qty;
        if (input.notes !== undefined) patch.notes = input.notes;
        if (input.manpower !== undefined) patch.manpower = input.manpower;
        const { error } = await (supabase as any).from("production_entries").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        const { error } = await (supabase as any).from("production_entries").insert({
          product_id: input.product_id,
          entry_date: input.entry_date,
          target_qty: input.target_qty ?? 0,
          completed_qty: input.completed_qty ?? 0,
          notes: input.notes ?? null,
          manpower: input.manpower ?? null,
          created_by: user?.id ?? null,
          branch_id: branchId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });
};

export const useAddProduct = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase as any).from("products").insert({ name: name.trim(), branch_id: branchId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("products").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};
