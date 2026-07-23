import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, useTodayEntries, useUpsertEntry } from "@/hooks/useProduction";
import { useRole } from "@/hooks/useRole";
import { useMyActiveOverrides } from "@/hooks/useOverride";
import { todayISO } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Layers, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type SubProductRow = { id: string; product_id: string; name: string; code: string | null };

const ALL = "__all__";

export default function DailyOverview() {
  const { data: products = [] } = useProducts();
  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("id, product_id, name, code")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SubProductRow[];
    },
  });
  const { data: todayEntries = [] } = useTodayEntries();
  const upsert = useUpsertEntry();
  const { role } = useRole();
  const { data: activeOverrides = [] } = useMyActiveOverrides();

  const [selectedProduct, setSelectedProductState] = useState<string>(ALL);
  const [selectedSubProduct, setSelectedSubProduct] = useState<string>(ALL);

  const setSelectedProduct = (v: string) => {
    setSelectedProductState(v);
    setSelectedSubProduct(ALL);
  };
  const reset = () => {
    setSelectedProductState(ALL);
    setSelectedSubProduct(ALL);
  };

  const filteredSubs = useMemo(
    () =>
      selectedProduct !== ALL ? subProducts.filter((s) => s.product_id === selectedProduct) : [],
    [subProducts, selectedProduct],
  );

  const productCode = useMemo(() => {
    if (selectedSubProduct !== ALL)
      return subProducts.find((s) => s.id === selectedSubProduct)?.code ?? "";
    if (selectedProduct !== ALL) return products.find((p) => p.id === selectedProduct)?.code ?? "";
    return "";
  }, [selectedSubProduct, selectedProduct, subProducts, products]);

  const productDisabled = !products.length;
  const subDisabled = selectedProduct === ALL || filteredSubs.length === 0;

  // The product_id we'd write to: a specific sub-product, or a product with no subs.
  const targetProductId = useMemo(() => {
    if (selectedSubProduct !== ALL) return selectedSubProduct;
    if (selectedProduct !== ALL && filteredSubs.length === 0) return selectedProduct;
    return null;
  }, [selectedProduct, selectedSubProduct, filteredSubs.length]);

  // Sum metrics for the current selection (covers "All" + grouped views).
  const metrics = useMemo(() => {
    let entries = todayEntries;
    if (selectedSubProduct !== ALL) {
      entries = entries.filter((e) => e.product_id === selectedSubProduct);
    } else if (selectedProduct !== ALL) {
      const subIds = new Set(
        subProducts.filter((s) => s.product_id === selectedProduct).map((s) => s.id),
      );
      entries = entries.filter((e) => e.product_id === selectedProduct || subIds.has(e.product_id));
    }
    return {
      target: entries.reduce((s, e) => s + (e.target_qty ?? 0), 0),
      completed: entries.reduce((s, e) => s + (e.completed_qty ?? 0), 0),
      manpower: entries.reduce((s, e) => s + (e.manpower ?? 0), 0),
    };
  }, [todayEntries, selectedProduct, selectedSubProduct, subProducts]);

  // Editable fields — pre-fill with the existing entry for the targeted product.
  const [target, setTarget] = useState<string>("");
  const [completed, setCompleted] = useState<string>("");
  const [manpower, setManpower] = useState<string>("");

  useEffect(() => {
    if (!targetProductId) {
      setTarget("");
      setCompleted("");
      setManpower("");
      return;
    }
    const existing = todayEntries.find((e) => e.product_id === targetProductId);
    setTarget(existing?.target_qty != null ? String(existing.target_qty) : "");
    setCompleted(existing?.completed_qty != null ? String(existing.completed_qty) : "");
    setManpower(existing?.manpower != null ? String(existing.manpower) : "");
  }, [targetProductId, todayEntries]);

  const parseNum = (v: string) => {
    if (v.trim() === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return NaN;
    return Math.floor(n);
  };

  const onSave = async () => {
    const isManager = role?.role === "manager";
    const hasOverride = targetProductId
      ? activeOverrides.some((o: any) => o.product_id === targetProductId)
      : false;
    const canEditTargets = isManager || hasOverride;
    if (!targetProductId) return;
    if (canEditTargets) {
      const raw = (v: string) => (v.trim() === "" ? "0" : v);
      const t = parseNum(raw(target))!;
      const c = parseNum(raw(completed))!;
      const m = parseNum(raw(manpower))!;
      if (Number.isNaN(t) || Number.isNaN(c) || Number.isNaN(m)) {
        toast.error("Enter valid numbers (0 – 1,000,000)");
        return;
      }

      const existingEntry = todayEntries.find((e) => e.product_id === targetProductId);
      const existingCompleted = existingEntry?.completed_qty;
      const completedChanged = existingCompleted == null || existingCompleted !== c;

      if (c < t && completed.trim() !== "" && completedChanged) {
        setReasonModal({
          payload: { product_id: targetProductId, entry_date: todayISO(), target_qty: t, completed_qty: c, manpower: m },
          source: "save",
        });
        setDelayReason("");
        setReasonError("");
        return;
      }

      const payload = {
        product_id: targetProductId,
        entry_date: todayISO(),
        target_qty: t,
        completed_qty: c,
        manpower: m,
      };
      try {
        await upsert.mutateAsync(payload);
        toast.success("Daily values saved");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to save");
      }
    } else {
      const c = parseNum(completed);
      if (c === undefined || Number.isNaN(c)) {
        toast.error("Enter a valid completed quantity");
        return;
      }
      try {
        await upsert.mutateAsync({
          product_id: targetProductId,
          entry_date: todayISO(),
          completed_qty: c,
        });
        toast.success("Completed updated");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to update");
      }
    }
  };

  const [settingField, setSettingField] = useState<null | "target" | "completed" | "manpower">(
    null,
  );
  const [invalidField, setInvalidField] = useState<null | "target" | "completed" | "manpower">(
    null,
  );

  // Reason-for-delay modal
  const [reasonModal, setReasonModal] = useState<{
    payload: {
      product_id: string;
      entry_date: string;
      target_qty?: number;
      completed_qty?: number;
      manpower?: number;
    };
    source: "save" | "completed";
  } | null>(null);
  const [delayReason, setDelayReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const setSingleField = async (field: "target" | "completed" | "manpower", rawValue: string) => {
    const isManager = role?.role === "manager";
    const hasOverride = targetProductId
      ? activeOverrides.some((o: any) => o.product_id === targetProductId)
      : false;
    if (!isManager && !hasOverride && field !== "completed") {
      toast.error("Only managers can edit targets or manpower.");
      return;
    }
    if (!targetProductId) return;
    const n = rawValue.trim() === "" ? 0 : parseNum(rawValue);
    if (n === undefined || Number.isNaN(n)) {
      setInvalidField(field);
      toast.error("Enter a valid number (0 – 1,000,000)");
      setTimeout(() => setInvalidField((f) => (f === field ? null : f)), 1500);
      return;
    }
    const existing = todayEntries.find((e) => e.product_id === targetProductId);
    const payload = {
      product_id: targetProductId,
      entry_date: todayISO(),
      target_qty: existing?.target_qty ?? 0,
      completed_qty: existing?.completed_qty ?? 0,
      manpower: existing?.manpower ?? 0,
    };
    if (field === "target") payload.target_qty = n;
    if (field === "completed") payload.completed_qty = n;
    if (field === "manpower") payload.manpower = n;
    // Show reason modal if completed is being set below target
    if (field === "completed" && n < payload.target_qty) {
      setReasonModal({ payload, source: "completed" });
      setDelayReason("");
      setReasonError("");
      return;
    }
    try {
      setSettingField(field);
      await upsert.mutateAsync(payload);
      toast.success(
        field === "target"
          ? "Morning Target updated"
          : field === "completed"
            ? "Evening Completed updated"
            : "Manpower Today updated",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSettingField(null);
    }
  };

  const isManager = role?.role === "manager";
  const hasOverride = targetProductId
    ? activeOverrides.some((o: any) => o.product_id === targetProductId)
    : false;
  const canEditTargets = isManager || hasOverride;
  const editingDisabled = !targetProductId;
  const targetDisabled = editingDisabled || !canEditTargets;
  const manpowerDisabled = editingDisabled || !canEditTargets;
  const completedDisabled = editingDisabled;
  const helper = editingDisabled
    ? selectedProduct === ALL
      ? "Select a product to edit today's values."
      : "Select a sub-product to edit today's values."
    : null;

  const submitWithReason = async () => {
    const reason = delayReason.trim();
    if (!reason) {
      setReasonError("Please enter a reason for the delay.");
      return;
    }
    if (!reasonModal) return;
    try {
      await upsert.mutateAsync({ ...reasonModal.payload, delay_reason: reason });
      toast.success("Daily values saved with delay reason");
      setReasonModal(null);
      setDelayReason("");
      setReasonError("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Daily Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filter today's production by product and sub-product, and update values.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/40 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Daily Overview
            </div>
            {(selectedProduct !== ALL || selectedSubProduct !== ALL) && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={reset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Product</Label>
            <Select
              value={selectedProduct}
              onValueChange={setSelectedProduct}
              disabled={productDisabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Product" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value={ALL}>All Products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Sub Product</Label>
            <Select
              value={selectedSubProduct}
              onValueChange={setSelectedSubProduct}
              disabled={subDisabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={subDisabled ? "—" : "Select Sub Product"} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value={ALL}>All Sub Products</SelectItem>
                {filteredSubs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Product Code</Label>
            <Input
              readOnly
              value={productCode}
              placeholder="—"
              className="h-9 text-sm bg-background/50"
            />
          </div>

          <div className="border-t border-border/60 pt-4 mt-1 space-y-3 text-sm">
            {helper && <p className="text-xs text-muted-foreground">{helper}</p>}

            <div className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
              <Label className="text-muted-foreground" htmlFor="do-target">
                Morning Target
              </Label>
              <Input
                id="do-target"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000000}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={targetDisabled}
                placeholder={editingDisabled ? String(metrics.target) : "0"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setSingleField("target", target);
                  }
                }}
                className={`h-9 text-sm text-right tabular-nums ${invalidField === "target" ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-9 px-3 rounded-md bg-success/15 text-success hover:bg-success/25 border border-success/30"
                disabled={targetDisabled || settingField === "target"}
                onClick={() => setSingleField("target", target)}
              >
                {settingField === "target" ? "…" : "Set"}
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
              <Label className="text-muted-foreground" htmlFor="do-completed">
                Evening Completed
              </Label>
              <Input
                id="do-completed"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000000}
                value={completed}
                onChange={(e) => setCompleted(e.target.value)}
                disabled={completedDisabled}
                placeholder={editingDisabled ? String(metrics.completed) : "0"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setSingleField("completed", completed);
                  }
                }}
                className={`h-9 text-sm text-right tabular-nums text-success ${invalidField === "completed" ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-9 px-3 rounded-md bg-success/15 text-success hover:bg-success/25 border border-success/30"
                disabled={completedDisabled || settingField === "completed"}
                onClick={() => setSingleField("completed", completed)}
              >
                {settingField === "completed" ? "…" : "Set"}
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
              <Label className="text-muted-foreground" htmlFor="do-manpower">
                Manpower Today
              </Label>
              <Input
                id="do-manpower"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000000}
                value={manpower}
                onChange={(e) => setManpower(e.target.value)}
                disabled={manpowerDisabled}
                placeholder={editingDisabled ? String(metrics.manpower) : "0"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setSingleField("manpower", manpower);
                  }
                }}
                className={`h-9 text-sm text-right tabular-nums ${invalidField === "manpower" ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-9 px-3 rounded-md bg-success/15 text-success hover:bg-success/25 border border-success/30"
                disabled={manpowerDisabled || settingField === "manpower"}
                onClick={() => setSingleField("manpower", manpower)}
              >
                {settingField === "manpower" ? "…" : "Set"}
              </Button>
            </div>

            <Button
              onClick={onSave}
              disabled={editingDisabled || upsert.isPending}
              className="w-full mt-2"
            >
              <Save className="h-4 w-4 mr-2" />
              {upsert.isPending ? "Saving…" : "Save"}
            </Button>

            {targetProductId && (
              <div className={`flex items-center gap-2 text-xs mt-2 px-2 py-1.5 rounded-md ${
                metrics.completed > 0
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${metrics.completed > 0 ? "bg-success" : "bg-warning"}`} />
                {metrics.completed > 0
                  ? "Production completed — Inventory, Quality, and Sales are enabled"
                  : metrics.target > 0
                    ? "Production in progress — Set Evening Completed to enable Inventory, Quality, and Sales"
                    : "Set Morning Target first"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reason for delay modal */}
      <Dialog
        open={reasonModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReasonModal(null);
            setDelayReason("");
            setReasonError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reason for Delay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Completed ({reasonModal?.payload.completed_qty}) is less than Target (
              {reasonModal?.payload.target_qty}). Please explain the reason for the shortfall.
            </p>
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter the reason for the delay..."
              value={delayReason}
              onChange={(e) => {
                setDelayReason(e.target.value);
                setReasonError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitWithReason();
                }
              }}
              autoFocus
            />
            {reasonError && <p className="text-sm text-destructive">{reasonError}</p>}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setReasonModal(null);
                  setDelayReason("");
                  setReasonError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={submitWithReason} disabled={upsert.isPending}>
                {upsert.isPending ? "Saving…" : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
