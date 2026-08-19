import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "./useBranch";
import { useCreateActivityLog } from "./useActivityLog";
import { todayISO } from "@/lib/format";

export type QualityCheck = {
  id: string;
  branch_id: string;
  product_id: string;
  production_entry_id: string | null;
  total_produced: number;
  passed_qty: number;
  rejected_qty: number;
  delivered_qty: number;
  rejection_reason: string | null;
  quality_notes: string | null;
  checked_by: string | null;
  checked_at: string;
  created_at: string;
};

export const COMMON_REJECTION_REASONS = [
  "Defective material",
  "Dimension error",
  "Surface defect",
  "Assembly issue",
  "Color mismatch",
  "Packaging damage",
  "Weight variation",
  "Strength failure",
  "Finishing defect",
  "Contamination",
  "Calibration error",
  "Other",
] as const;

export const useQualityChecks = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["quality_checks", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("quality_checks")
        .select("*, products!inner(name)")
        .order("checked_at", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as (QualityCheck & { products: { name: string } })[];
    },
  });
};

export const useQualityDashboard = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["quality_dashboard", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("production_entries")
        .select("completed_qty")
        .gte("entry_date", "2025-01-01");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data: prodData } = await q;

      let qc = (supabase as any)
        .from("quality_checks")
        .select("passed_qty, rejected_qty, delivered_qty");
      if (branchId) qc = qc.eq("branch_id", branchId);
      const { data: qcData } = await qc;

      const totalProduced = (prodData ?? []).reduce((s: number, r: any) => s + (r.completed_qty ?? 0), 0);
      const passed = (qcData ?? []).reduce((s: number, r: any) => s + (r.passed_qty ?? 0), 0);
      const rejected = (qcData ?? []).reduce((s: number, r: any) => s + (r.rejected_qty ?? 0), 0);
      const delivered = (qcData ?? []).reduce((s: number, r: any) => s + (r.delivered_qty ?? 0), 0);

      return { totalProduced, passed, rejected, delivered };
    },
  });
};

export const useRejectionReasons = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["rejection_reasons", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("quality_checks")
        .select("rejection_reason, rejected_qty")
        .not("rejection_reason", "is", null)
        .not("rejection_reason", "eq", "");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const reason = r.rejection_reason as string;
        map[reason] = (map[reason] ?? 0) + (r.rejected_qty ?? 0);
      });
      return Object.entries(map)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
};

export const useProductQualitySummary = () => {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["product_quality_summary", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("quality_checks")
        .select("product_id, passed_qty, rejected_qty, delivered_qty, products(name)");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      const map: Record<string, { name: string; passed: number; rejected: number; delivered: number }> = {};
      (data ?? []).forEach((r: any) => {
        const pid = r.product_id as string;
        if (!map[pid]) {
          map[pid] = { name: r.products?.name ?? pid, passed: 0, rejected: 0, delivered: 0 };
        }
        map[pid].passed += r.passed_qty ?? 0;
        map[pid].rejected += r.rejected_qty ?? 0;
        map[pid].delivered += r.delivered_qty ?? 0;
      });
      return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
};

export const useRecordQualityCheck = () => {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const logActivity = useCreateActivityLog();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      total_produced: number;
      passed_qty: number;
      rejected_qty: number;
      delivered_qty: number;
      rejection_reason?: string;
      quality_notes?: string;
      production_entry_id?: string;
      checked_at?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await (supabase as any)
        .from("quality_checks")
        .insert({
          branch_id: branchId,
          product_id: input.product_id,
          production_entry_id: input.production_entry_id ?? null,
          total_produced: input.total_produced,
          passed_qty: input.passed_qty,
          rejected_qty: input.rejected_qty,
          delivered_qty: input.delivered_qty,
          rejection_reason: input.rejection_reason ?? null,
          quality_notes: input.quality_notes ?? null,
          checked_by: user?.id ?? null,
          checked_at: input.checked_at ?? todayISO(),
        })
        .select()
        .single();
      if (error) throw error;

      const { data: prod } = await (supabase as any)
        .from("products")
        .select("name")
        .eq("id", input.product_id)
        .maybeSingle();
      const productName = prod?.name ?? input.product_id;
      logActivity.mutate({
        branch_id: branchId ?? undefined,
        product_id: input.product_id,
        action: "quality_check_recorded",
        description: `Quality check recorded for ${productName}: ${input.passed_qty} passed, ${input.rejected_qty} rejected, ${input.delivered_qty} delivered`,
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality_checks"] });
      qc.invalidateQueries({ queryKey: ["quality_dashboard"] });
      qc.invalidateQueries({ queryKey: ["rejection_reasons"] });
      qc.invalidateQueries({ queryKey: ["product_quality_summary"] });
    },
  });
};
