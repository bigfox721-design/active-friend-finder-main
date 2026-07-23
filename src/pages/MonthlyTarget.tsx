import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProduction";
import { useRole } from "@/hooks/useRole";
import { useBranch } from "@/hooks/useBranch";
import { useCreateActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { Target as TargetIcon, Loader2 } from "lucide-react";

type SubProduct = { id: string; product_id: string; name: string; code: string | null };
type MonthlyTargetRow = {
  id: string;
  branch_id: string | null;
  product_id: string;
  sub_product_id: string | null;
  year: number;
  month: number;
  target_qty: number;
};
type EntryRow = {
  id: string;
  product_id: string;
  entry_date: string;
  completed_qty: number;
  target_qty: number;
  manpower: number | null;
  delay_reason: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function MonthlyTarget() {
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const { role } = useRole();
  const { data: products = [] } = useProducts();

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [productId, setProductId] = useState<string>("ALL");
  const [subProductId, setSubProductId] = useState<string>("ALL");
  const [inputDailyTarget, setInputDailyTarget] = useState<string>("");

  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products", "monthly-target"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_products")
        .select("id, product_id, name, code")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SubProduct[];
    },
  });

  const filteredSubs = useMemo(
    () => (productId !== "ALL" ? subProducts.filter((s) => s.product_id === productId) : []),
    [subProducts, productId],
  );

  const monthStart = useMemo(() => toISO(new Date(year, month - 1, 1)), [year, month]);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const monthEnd = useMemo(
    () => toISO(new Date(year, month - 1, daysInMonth)),
    [year, month, daysInMonth],
  );

  // Keep selectedDate within the chosen month
  useEffect(() => {
    if (selectedDate.getFullYear() !== year || selectedDate.getMonth() + 1 !== month) {
      setSelectedDate(new Date(year, month - 1, 1));
    }
  }, [year, month]);

  const { data: targets = [] } = useQuery({
    queryKey: ["monthly_targets", branchId, year, month],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("monthly_targets")
        .select("*")
        .eq("year", year)
        .eq("month", month);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as MonthlyTargetRow[];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["monthly_entries_readonly", branchId, monthStart, monthEnd],
    enabled: !!branchId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("production_entries")
        .select("id, product_id, entry_date, completed_qty, target_qty, manpower, delay_reason")
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as EntryRow[];
    },
  });

  // Default monthly target (fallback for days that don't have a per-day override)
  const defaultDailyTarget = useMemo(() => {
    if (productId === "ALL") {
      return targets.reduce((sum, t) => sum + t.target_qty, 0);
    } else if (subProductId === "ALL") {
      return targets
        .filter((t) => t.product_id === productId)
        .reduce((sum, t) => sum + t.target_qty, 0);
    } else {
      const t = targets.find(
        (t) => t.product_id === productId && t.sub_product_id === subProductId,
      );
      return t ? t.target_qty : 0;
    }
  }, [targets, productId, subProductId]);

  const matchEntry = (e: EntryRow) => {
    if (productId === "ALL") return true;
    if (subProductId !== "ALL") return e.product_id === subProductId;
    const isSelf = e.product_id === productId;
    const isSub = subProducts.some((s) => s.id === e.product_id && s.product_id === productId);
    return isSelf || isSub;
  };

  // Per-day target for selected date (sum across matching entries on that date)
  const selectedDateISO = useMemo(() => toISO(selectedDate), [selectedDate]);
  const selectedDateTarget = useMemo(() => {
    const sum = entries
      .filter((e) => e.entry_date === selectedDateISO && matchEntry(e))
      .reduce((s, e) => s + (e.target_qty || 0), 0);
    return sum;
  }, [entries, selectedDateISO, productId, subProductId, subProducts]);

  // Sync input when selection changes
  useEffect(() => {
    const val = selectedDateTarget || defaultDailyTarget || 0;
    setInputDailyTarget(String(val));
  }, [selectedDateTarget, defaultDailyTarget, productId, subProductId, selectedDateISO]);

  const logActivity = useCreateActivityLog();

  const upsertDailyTarget = useMutation({
    mutationFn: async () => {
      if (role?.role !== "manager") throw new Error("Only managers can edit targets.");
      if (productId === "ALL") throw new Error("Select a specific product to save a target.");
      const qty = Number(inputDailyTarget);
      if (!Number.isFinite(qty) || qty < 0) throw new Error("Enter a valid target");
      // Save against sub-product if chosen, otherwise against the product itself
      const targetProductId = subProductId !== "ALL" ? subProductId : productId;

      // Make sure the products row exists for this id (sub-product mirror)
      const { data: prodExists } = await supabase
        .from("products")
        .select("id")
        .eq("id", targetProductId)
        .maybeSingle();
      if (!prodExists) {
        const { data: sub } = await supabase
          .from("sub_products")
          .select("id, name, code, product_id, product:products(branch_id, unit)")
          .eq("id", targetProductId)
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
        .select("id")
        .eq("product_id", targetProductId)
        .eq("entry_date", selectedDateISO)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("production_entries")
          .update({ target_qty: Math.floor(qty) })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        const { error } = await (supabase as any).from("production_entries").insert({
          product_id: targetProductId,
          entry_date: selectedDateISO,
          target_qty: Math.floor(qty),
          completed_qty: 0,
          branch_id: branchId,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      supabase.auth.getUser().then(({ data: userData }) => {
        logActivity.mutate({
          branch_id: branchId ?? undefined,
          product_id: subProductId !== "ALL" ? subProductId : productId,
          action: "target_set",
          description: `Daily target set to ${inputDailyTarget} for ${subProductId !== "ALL" ? "sub-product" : "product"} on ${format(selectedDate, "PPP")}`,
          user_name: userData?.user?.email?.split("@")[0] ?? "Unknown",
        });
      });
      toast.success(`Target saved for ${format(selectedDate, "PPP")}`);
      qc.invalidateQueries({ queryKey: ["monthly_entries_readonly"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save target"),
  });

  const autoMonthlyTarget = useMemo(() => {
    // Sum per-day targets across the month (use override if set, else default)
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTarget = entries
        .filter((e) => e.entry_date === dateStr && matchEntry(e))
        .reduce((s, e) => s + (e.target_qty || 0), 0);
      total += dayTarget || defaultDailyTarget || 0;
    }
    return total;
  }, [daysInMonth, year, month, entries, productId, subProductId, subProducts, defaultDailyTarget]);

  const todayISOStr = toISO(new Date());

  const rows = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return days.map((day) => {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const matching = entries.filter((e) => e.entry_date === dateStr && matchEntry(e));
      const hasEntry = matching.length > 0;
      const actualProd = matching.reduce((sum, e) => sum + (e.completed_qty || 0), 0);
      const dayTargetOverride = matching.reduce((sum, e) => sum + (e.target_qty || 0), 0);
      const dayTarget = dayTargetOverride || defaultDailyTarget || 0;
      const hasManpower = matching.some((e) => e.manpower != null);
      const manpower = matching.reduce((sum, e) => sum + (e.manpower || 0), 0);
      const delayReasons = matching
        .map((e) => e.delay_reason)
        .filter((r): r is string => r != null);
      const delayReason = delayReasons.length > 0 ? delayReasons.join("; ") : null;

      const isFuture = dateStr > todayISOStr;
      let status: "Achieved" | "Not Achieved" | "Pending" | "No Target Set" | "No Data Set" = "Pending";
      if (!hasEntry && dayTarget === 0) status = "No Target Set";
      else if (hasEntry) {
        if (dayTarget > 0 && actualProd >= dayTarget) status = "Achieved";
        else if (dayTarget === 0 && actualProd > 0) status = "Achieved";
        else if (!hasManpower) status = "No Data Set";
        else status = "Not Achieved";
      }

      return {
        day,
        dateStr,
        target: dayTarget,
        actual: actualProd,
        manpower,
        hasManpower,
        hasEntry,
        isFuture,
        status,
        delayReason,
      };
    });
  }, [
    daysInMonth,
    year,
    month,
    entries,
    productId,
    subProductId,
    subProducts,
    defaultDailyTarget,
    todayISOStr,
  ]);

  type EditField = "completed" | "manpower";
  const [editingCell, setEditingCell] = useState<{ day: number; field: EditField } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Reason-for-delay modal
  const [reasonModal, setReasonModal] = useState<{
    dateStr: string;
    targetQty: number;
    completedQty: number;
  } | null>(null);
  const [delayReason, setDelayReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const upsertCompleted = useMutation({
    mutationFn: async (args: {
      dateStr: string;
      field: EditField;
      qty: number;
      delay_reason?: string | null;
    }) => {
      if (role?.role !== "manager") throw new Error("Only managers can edit.");
      if (productId === "ALL") throw new Error("Select a specific product to update.");
      const qty = args.qty;
      if (!Number.isFinite(qty) || qty < 0) throw new Error("Enter a valid number");
      const targetProductId = subProductId !== "ALL" ? subProductId : productId;

      const { data: prodExists } = await supabase
        .from("products")
        .select("id")
        .eq("id", targetProductId)
        .maybeSingle();
      if (!prodExists) {
        const { data: sub } = await supabase
          .from("sub_products")
          .select("id, name, code, product_id, product:products(branch_id, unit)")
          .eq("id", targetProductId)
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
        .select("id")
        .eq("product_id", targetProductId)
        .eq("entry_date", args.dateStr)
        .maybeSingle();

      const patch: Record<string, any> =
        args.field === "manpower"
          ? { manpower: Math.floor(qty) }
          : { completed_qty: Math.floor(qty) };
      if (args.delay_reason !== undefined) patch.delay_reason = args.delay_reason;

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("production_entries")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        const insertRow: Record<string, any> = {
          product_id: targetProductId,
          entry_date: args.dateStr,
          target_qty: Math.floor(defaultDailyTarget || 0),
          completed_qty: 0,
          branch_id: branchId,
          created_by: user?.id ?? null,
          delay_reason: args.delay_reason ?? null,
          ...patch,
        };
        const { error } = await (supabase as any).from("production_entries").insert(insertRow);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      const targetId = subProductId !== "ALL" ? subProductId : productId;
      const sub = subProducts.find((s) => s.id === targetId);
      const prod = products.find((p) => p.id === (sub?.product_id ?? targetId));
      const productName = sub ? `${prod?.name ?? ""} - ${sub.name}` : (prod?.name ?? targetId);
      logActivity.mutate({
        branch_id: branchId ?? undefined,
        product_id: targetId,
        action: vars.field === "manpower" ? "entry_updated" : "entry_updated",
        description: `${vars.field === "manpower" ? "Manpower" : "Completed"} updated to ${vars.qty} for ${productName} — ${format(new Date(vars.dateStr), "PPP")}`,
      });
      if (vars.delay_reason) {
        logActivity.mutate({
          branch_id: branchId ?? undefined,
          product_id: targetId,
          action: "delay_reason",
          description: `Delay reason for ${productName}: ${vars.delay_reason}`,
        });
      }
      toast.success(vars.field === "manpower" ? "Manpower updated" : "Completed updated");
      setEditingCell(null);
      qc.invalidateQueries({ queryKey: ["monthly_entries_readonly"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  const startEdit = (day: number, field: EditField, current: number, has: boolean) => {
    setEditingCell({ day, field });
    setEditValue(has ? String(current) : "");
  };

  const commitEdit = (dateStr: string, field: EditField) => {
    const n = Number(editValue);
    if (editValue === "" || !Number.isFinite(n)) {
      setEditingCell(null);
      return;
    }
    if (field === "completed") {
      const row = rows.find((r) => r.dateStr === dateStr);
      if (row && n < row.target) {
        setReasonModal({ dateStr, targetQty: row.target, completedQty: n });
        setDelayReason("");
        setReasonError("");
        return;
      }
    }
    upsertCompleted.mutate({ dateStr, field, qty: n });
  };

  const submitReason = async () => {
    const reason = delayReason.trim();
    if (!reason) {
      setReasonError("Please enter the reason for not achieving the target.");
      return;
    }
    if (!reasonModal) return;
    await upsertCompleted.mutateAsync({
      dateStr: reasonModal.dateStr,
      field: "completed",
      qty: reasonModal.completedQty,
      delay_reason: reason,
    });
    setReasonModal(null);
    setDelayReason("");
    setReasonError("");
    setEditingCell(null);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
            <TargetIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Monthly Target</h1>
            <p className="text-sm text-muted-foreground">
              Pick a date and set the target you want for that day.
            </p>
          </div>
        </div>

        {/* TARGET SETTING */}
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="mb-1.5 block">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      if (d) {
                        setSelectedDate(d);
                        setYear(d.getFullYear());
                        setMonth(d.getMonth() + 1);
                      }
                    }}
                    month={new Date(year, month - 1, 1)}
                    onMonthChange={(d) => {
                      setYear(d.getFullYear());
                      setMonth(d.getMonth() + 1);
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="mb-1.5 block">Product</Label>
              <Select
                value={productId}
                onValueChange={(v) => {
                  setProductId(v);
                  setSubProductId("ALL");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Sub Product</Label>
              <Select
                value={subProductId}
                onValueChange={setSubProductId}
                disabled={productId === "ALL" || filteredSubs.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      productId === "ALL"
                        ? "Select product first"
                        : filteredSubs.length === 0
                          ? "No sub products"
                          : "All Sub Products"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sub Products</SelectItem>
                  {filteredSubs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Target for selected date</Label>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  upsertDailyTarget.mutate();
                }}
              >
                <Input
                  type="number"
                  min={0}
                  value={inputDailyTarget}
                  onChange={(e) => setInputDailyTarget(e.target.value)}
                  disabled={productId === "ALL" || role?.role !== "manager"}
                  className="rounded-md"
                />
                {productId !== "ALL" && (
                  <Button
                    type="submit"
                    disabled={upsertDailyTarget.isPending || role?.role !== "manager"}
                    className="shrink-0"
                  >
                    {upsertDailyTarget.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                )}
              </form>
            </div>
          </div>

          <Separator className="my-6" />

          <div>
            <Label className="mb-1.5 block">Auto Monthly Target (sum of daily targets)</Label>
            <Input
              readOnly
              value={autoMonthlyTarget}
              className="bg-background/50 rounded-md w-full md:w-1/4"
            />
          </div>

          <Separator className="my-6" />

          <div className="mt-2">
            <h2 className="text-base font-semibold mb-4">Day-wise Tracking</h2>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-24">Day</TableHead>
                    <TableHead className="text-right">Daily Target</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Manpower</TableHead>
                    <TableHead className="w-40 text-center">Status</TableHead>
                    <TableHead className="max-w-[200px]">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const editable = !r.isFuture && productId !== "ALL";
                    const isEditingCompleted =
                      editingCell?.day === r.day && editingCell?.field === "completed";
                    const isEditingManpower =
                      editingCell?.day === r.day && editingCell?.field === "manpower";
                    const missing = !r.hasEntry && !r.isFuture;
                    return (
                      <TableRow
                        key={r.day}
                        className={cn(
                          r.dateStr === selectedDateISO && "bg-primary/5",
                          missing && "bg-warning/5",
                        )}
                      >
                        <TableCell className="font-medium">
                          Day {r.day}
                          {missing && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-warning">
                              Missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.target.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isEditingCompleted ? (
                            <Input
                              type="number"
                              min={0}
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(r.dateStr, "completed")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit(r.dateStr, "completed");
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-8 w-24 ml-auto text-right"
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() =>
                                editable && startEdit(r.day, "completed", r.actual, r.hasEntry)
                              }
                              className={cn(
                                "w-full text-right tabular-nums px-2 py-1 rounded",
                                editable && "hover:bg-muted/50 cursor-pointer",
                                !editable && "cursor-not-allowed opacity-70",
                              )}
                              title={
                                r.isFuture
                                  ? "Future day — not editable"
                                  : productId === "ALL"
                                    ? "Select a specific product to edit"
                                    : "Click to edit"
                              }
                            >
                              {r.hasEntry ? r.actual.toLocaleString() : "—"}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isEditingManpower ? (
                            <Input
                              type="number"
                              min={0}
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(r.dateStr, "manpower")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit(r.dateStr, "manpower");
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-8 w-24 ml-auto text-right"
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() =>
                                editable && startEdit(r.day, "manpower", r.manpower, r.hasManpower)
                              }
                              className={cn(
                                "w-full text-right tabular-nums px-2 py-1 rounded",
                                editable && "hover:bg-muted/50 cursor-pointer",
                                !editable && "cursor-not-allowed opacity-70",
                              )}
                              title={
                                r.isFuture
                                  ? "Future day — not editable"
                                  : productId === "ALL"
                                    ? "Select a specific product to edit"
                                    : "Click to edit"
                              }
                            >
                              {r.hasManpower ? r.manpower.toLocaleString() : "-"}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.status === "Achieved" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 font-medium">
                              Achieved
                            </Badge>
                          ) : r.status === "Not Achieved" ? (
                            <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 font-medium border-transparent">
                              Not Achieved
                            </Badge>
                          ) : r.status === "No Target Set" ? (
                            <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 font-medium border-transparent">
                              No Target Set
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 font-medium border-transparent">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm truncate" title={r.delayReason ?? ""}>
                          {r.delayReason ? (
                            <span className="text-muted-foreground cursor-default">{r.delayReason}</span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
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
              Completed ({reasonModal?.completedQty}) is less than Target ({reasonModal?.targetQty}
              ). Please explain the reason for the shortfall.
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
                  submitReason();
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
              <Button onClick={submitReason} disabled={upsertCompleted.isPending}>
                {upsertCompleted.isPending ? "Saving…" : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
