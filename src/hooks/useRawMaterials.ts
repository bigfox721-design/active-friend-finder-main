import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";
import { useCreateActivityLog } from "./useActivityLog";

export type RawMaterial = {
  id: string;
  name: string;
  unit: string;
  created_at: string;
};

export type RawInventory = {
  id: string;
  branch_id: string;
  raw_material_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  raw_materials: { name: string; unit: string } | null;
};

export const useRawMaterials = () =>
  useQuery({
    queryKey: ["raw_materials"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("raw_materials")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as RawMaterial[];
    },
  });

export const useRawInventory = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["raw_inventory", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("raw_inventory")
        .select("*, raw_materials:raw_material_id(name, unit)")
        .order("raw_material_id");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as RawInventory[];
    },
  });
};

export const useSendRawMaterial = () => {
  const qc = useQueryClient();
  const logActivity = useCreateActivityLog();
  const { data: rawMaterials } = useRawMaterials();
  const materialName = useCallback((id: string) => rawMaterials?.find((m) => m.id === id)?.name ?? "Unknown", [rawMaterials]);
  return useMutation({
    mutationFn: async (input: {
      raw_material_id: string;
      quantity: number;
      source_branch_id: string;
      dest_branch_id: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .rpc("send_raw_material", {
          p_raw_material_id: input.raw_material_id,
          p_quantity: input.quantity,
          p_source_branch_id: input.source_branch_id,
          p_dest_branch_id: input.dest_branch_id,
          p_notes: input.notes ?? null,
        });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["raw_inventory"] });
      qc.invalidateQueries({ queryKey: ["material_transfers"] });
      logActivity.mutate({
        action: "transfer_init",
        description: `Raw material sent: ${materialName(input.raw_material_id)} x${input.quantity}`,
        branch_id: input.source_branch_id,
      });
    },
  });
};

export const useReceiveRawMaterial = () => {
  const qc = useQueryClient();
  const logActivity = useCreateActivityLog();
  const { branchId } = useBranch();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const { data, error } = await supabase
        .rpc("receive_raw_material", { p_transfer_id: transferId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw_inventory"] });
      qc.invalidateQueries({ queryKey: ["material_transfers"] });
      logActivity.mutate({
        action: "transfer_complete",
        description: "Raw material transfer received",
        branch_id: branchId,
      });
    },
  });
};
