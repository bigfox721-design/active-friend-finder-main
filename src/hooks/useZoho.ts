import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SyncResult } from "@/lib/zoho.functions";

async function triggerSync(): Promise<SyncResult> {
  const mod = await import("@/lib/zoho.functions");
  return mod.syncZohoInvoices();
}

async function fetchStatus(): Promise<{ total: number; lastSync: string | null; recentErrors: number }> {
  const mod = await import("@/lib/zoho.functions");
  return mod.getZohoSyncStatus();
}

export const useZohoSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zoho-sync-status"] });
    },
  });
};

export const useZohoSyncStatus = () =>
  useQuery({
    queryKey: ["zoho-sync-status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
  });
