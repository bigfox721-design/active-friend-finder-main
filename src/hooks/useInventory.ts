import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";
import { useCreateActivityLog } from "./useActivityLog";

export type InventoryItem = {
  id: string;
  branch_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  plan_qty: number;
  actual_complete_qty: number;
  unit: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Accessory = {
  id: string;
  branch_id: string;
  name: string;
  code: string | null;
  unit: string;
  created_at: string;
};

export type AccessoryInventory = {
  id: string;
  branch_id: string;
  accessory_id: string;
  plan_qty: number;
  actual_complete_qty: number;
  stock_qty: number;
  created_at: string;
  updated_at: string;
};

export const useInventory = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["inventory", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("inventory")
        .select("*")
        .order("product_name", { ascending: true });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as InventoryItem[];
    },
  });
};

export const useAccessories = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["accessories", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any).from("accessories").select("*").order("name", { ascending: true });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Accessory[];
    },
  });
};

export const useAccessoryInventory = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["accessory_inventory", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any).from("accessory_inventory").select("*");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as AccessoryInventory[];
    },
  });
};

export const useSaveProductInventory = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const logActivity = useCreateActivityLog();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      product_name: string;
      plan_qty: number;
      actual_complete_qty: number;
      stock_qty: number;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: existing } = await (supabase as any)
        .from("inventory")
        .select("id")
        .eq("branch_id", branchId)
        .eq("product_id", input.product_id)
        .maybeSingle();

      const payload: Record<string, any> = {
        plan_qty: input.plan_qty,
        actual_complete_qty: input.actual_complete_qty,
        quantity: input.stock_qty,
        updated_by: user?.id ?? null,
      };

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("inventory")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("inventory").insert({
          branch_id: branchId,
          product_id: input.product_id,
          product_name: input.product_name,
          ...payload,
          unit: "pcs",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      logActivity.mutate({
        action: "inventory_adjust",
        description: `Product inventory updated: ${input.product_name} — Plan: ${input.plan_qty}, Actual: ${input.actual_complete_qty}, Stock: ${input.stock_qty}`,
        branch_id: branchId,
        product_id: input.product_id,
      });
    },
  });
};

export const useSaveAccessoryInventory = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const logActivity = useCreateActivityLog();
  return useMutation({
    mutationFn: async (input: {
      accessory_id: string;
      plan_qty: number;
      actual_complete_qty: number;
      stock_qty: number;
    }) => {
      const { data: existing } = await (supabase as any)
        .from("accessory_inventory")
        .select("id")
        .eq("branch_id", branchId)
        .eq("accessory_id", input.accessory_id)
        .maybeSingle();

      const payload: Record<string, any> = {
        plan_qty: input.plan_qty,
        actual_complete_qty: input.actual_complete_qty,
        stock_qty: input.stock_qty,
      };

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("accessory_inventory")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("accessory_inventory").insert({
          branch_id: branchId,
          accessory_id: input.accessory_id,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["accessory_inventory"] });
      logActivity.mutate({
        action: "inventory_adjust",
        description: `Accessory inventory updated — Plan: ${input.plan_qty}, Actual: ${input.actual_complete_qty}, Stock: ${input.stock_qty}`,
        branch_id: branchId,
      });
    },
  });
};

export type InventoryLogEntry = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  change_type: "SALE" | "PRODUCTION" | "ADJUSTMENT" | "TRANSFER" | "RETURN";
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
};

export const useInventoryLogs = (productId?: string, limit = 100) =>
  useQuery({
    queryKey: ["inventory_logs", productId, limit],
    queryFn: async () => {
      let q = (supabase as any)
        .from("inventory_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data as InventoryLogEntry[];
    },
  });

export const useInventoryLogsByReference = (referenceId: string) =>
  useQuery({
    queryKey: ["inventory_logs", "ref", referenceId],
    enabled: !!referenceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_logs")
        .select("*")
        .eq("reference_id", referenceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InventoryLogEntry[];
    },
  });
