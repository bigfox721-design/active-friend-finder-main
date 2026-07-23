import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProducts } from "@/hooks/useProduction";
import {
  useQualityChecks,
  useQualityDashboard,
  useRejectionReasons,
  useProductQualitySummary,
  useRecordQualityCheck,
} from "@/hooks/useQualityChecks";
import { useBranch } from "@/hooks/useBranch";
import {
  ClipboardCheck,
  Loader2,
  Plus,
  ThumbsUp,
  ThumbsDown,
  PackageCheck,
  Truck,
  BarChart3,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { fmtNum, todayISO } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export default function QualityChecksPage() {
  const { branchId, branches } = useBranch();
  const { data: products = [] } = useProducts();
  const { data: checks = [] } = useQualityChecks();
  const { data: dashboard, isLoading: dashLoading } = useQualityDashboard();
  const { data: rejectionReasons = [] } = useRejectionReasons();
  const { data: productSummary = [] } = useProductQualitySummary();
  const recordCheck = useRecordQualityCheck();

  const [showForm, setShowForm] = useState(false);
  const [formProduct, setFormProduct] = useState("");
  const [formTotal, setFormTotal] = useState("");
  const [formPassed, setFormPassed] = useState("");
  const [formRejected, setFormRejected] = useState("");
  const [formDelivered, setFormDelivered] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<"history" | "products" | "reasons">("history");

  const { data: todayProdEntry } = useQuery({
    queryKey: ["entries", "quality-check", formProduct],
    enabled: !!formProduct,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("production_entries")
        .select("target_qty, completed_qty")
        .eq("product_id", formProduct)
        .eq("entry_date", todayISO())
        .maybeSingle();
      return data as { target_qty: number; completed_qty: number } | null;
    },
  });

  const productionCompleted = !formProduct || (todayProdEntry && todayProdEntry.completed_qty > 0);

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  const resetForm = () => {
    setFormProduct("");
    setFormTotal("");
    setFormPassed("");
    setFormRejected("");
    setFormDelivered("");
    setFormReason("");
    setFormNotes("");
    setFormDate(new Date().toISOString().slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProduct) return toast.error("Select a product");
    const total = Number(formTotal);
    const passed = Number(formPassed);
    const rejected = Number(formRejected);
    const delivered = Number(formDelivered);
    if (!Number.isFinite(total) || total < 0) return toast.error("Enter a valid total produced");
    if (!Number.isFinite(passed) || passed < 0) return toast.error("Enter a valid passed quantity");
    if (!Number.isFinite(rejected) || rejected < 0) return toast.error("Enter a valid rejected quantity");
    if (!Number.isFinite(delivered) || delivered < 0) return toast.error("Enter a valid delivered quantity");

    try {
      await recordCheck.mutateAsync({
        product_id: formProduct,
        total_produced: total,
        passed_qty: passed,
        rejected_qty: rejected,
        delivered_qty: delivered,
        rejection_reason: formReason.trim() || undefined,
        quality_notes: formNotes.trim() || undefined,
        checked_at: formDate,
      });
      toast.success("Quality check recorded");
      setShowForm(false);
      resetForm();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record quality check");
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Quality Checks</h1>
            <p className="text-sm text-muted-foreground">
              Track passed, rejected, and delivered quantities{branchName ? ` for ${branchName}` : ""}
            </p>
          </div>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Record Check
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Quality Check</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select value={formProduct} onValueChange={setFormProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Total Produced</Label>
                  <Input type="number" min={0} value={formTotal} onChange={(e) => setFormTotal(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Passed</Label>
                  <Input type="number" min={0} value={formPassed} onChange={(e) => setFormPassed(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Rejected</Label>
                  <Input type="number" min={0} value={formRejected} onChange={(e) => setFormRejected(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Delivered</Label>
                  <Input type="number" min={0} value={formDelivered} onChange={(e) => setFormDelivered(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Rejection Reason</Label>
                <Input
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Type reason if any rejected"
                />
              </div>
              <div>
                <Label>Quality Notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional notes about the quality check"
                  rows={2}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {!productionCompleted && formProduct && (
                  <p className="text-xs text-warning mr-auto">
                    Complete production first (set Evening Completed in Daily Overview)
                  </p>
                )}
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={recordCheck.isPending || (!productionCompleted && !!formProduct)}>
                  {recordCheck.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Check
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Produced</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmtNum(dashboard?.totalProduced ?? 0)}
          </p>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Passed</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">
            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmtNum(dashboard?.passed ?? 0)}
          </p>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Rejected</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">
            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmtNum(dashboard?.rejected ?? 0)}
          </p>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Truck className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Delivered</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-blue-500">
            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmtNum(dashboard?.delivered ?? 0)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6">
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "history" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Check History
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "products" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Product Status
            </button>
            <button
              onClick={() => setActiveTab("reasons")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "reasons" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rejection Reasons
            </button>
          </div>

          {/* Tab: History */}
          {activeTab === "history" && (
            <Card className="p-5">
              {checks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No quality checks recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-sm font-medium text-muted-foreground">
                        <th className="text-left py-3 px-2">Date</th>
                        <th className="text-left py-3 px-2">Product</th>
                        <th className="text-right py-3 px-2">Produced</th>
                        <th className="text-right py-3 px-2">Passed</th>
                        <th className="text-right py-3 px-2">Rejected</th>
                        <th className="text-right py-3 px-2">Delivered</th>
                        <th className="text-left py-3 px-2">Reason</th>
                        <th className="text-left py-3 px-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checks.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(c.checked_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2 font-medium">{(c as any).products?.name ?? "—"}</td>
                          <td className="py-3 px-2 text-right tabular-nums">{fmtNum(c.total_produced)}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-emerald-600 font-medium">{fmtNum(c.passed_qty)}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-red-500 font-medium">{fmtNum(c.rejected_qty)}</td>
                          <td className="py-3 px-2 text-right tabular-nums text-blue-500 font-medium">{fmtNum(c.delivered_qty)}</td>
                          <td className="py-3 px-2 text-sm text-muted-foreground max-w-[160px] truncate">
                            {c.rejection_reason ?? "—"}
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground max-w-[160px] truncate">
                            {c.quality_notes ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Tab: Product Status */}
          {activeTab === "products" && (
            <Card className="p-5">
              {productSummary.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No quality data per product yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-sm font-medium text-muted-foreground">
                        <th className="text-left py-3 px-2">Product</th>
                        <th className="text-right py-3 px-2">Passed</th>
                        <th className="text-right py-3 px-2">Rejected</th>
                        <th className="text-right py-3 px-2">Delivered</th>
                        <th className="text-right py-3 px-2">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSummary.map((p) => {
                        const total = p.passed + p.rejected;
                        const rate = total > 0 ? ((p.passed / total) * 100).toFixed(1) : "—";
                        return (
                          <tr key={p.name} className="border-b last:border-0">
                            <td className="py-3 px-2 font-medium">{p.name}</td>
                            <td className="py-3 px-2 text-right tabular-nums text-emerald-600">{fmtNum(p.passed)}</td>
                            <td className="py-3 px-2 text-right tabular-nums text-red-500">{fmtNum(p.rejected)}</td>
                            <td className="py-3 px-2 text-right tabular-nums text-blue-500">{fmtNum(p.delivered)}</td>
                            <td className="py-3 px-2 text-right tabular-nums font-medium">{rate}{rate !== "—" ? "%" : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Tab: Rejection Reasons */}
          {activeTab === "reasons" && (
            <Card className="p-5">
              {rejectionReasons.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No rejection reasons recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {rejectionReasons.map((r) => {
                    const totalRejected = rejectionReasons.reduce((s, x) => s + x.count, 0);
                    const pct = totalRejected > 0 ? ((r.count / totalRejected) * 100).toFixed(1) : "0";
                    return (
                      <div key={r.reason} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-40 truncate">{r.reason}</span>
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500/70 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground w-20 text-right">
                          {fmtNum(r.count)} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Summary & Recent Checks */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Summary
            </h3>
            {dashLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Passed</span>
                  <span className="font-medium tabular-nums text-emerald-600">{fmtNum(dashboard?.passed ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Rejected</span>
                  <span className="font-medium tabular-nums text-red-500">{fmtNum(dashboard?.rejected ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Delivered</span>
                  <span className="font-medium tabular-nums text-blue-500">{fmtNum(dashboard?.delivered ?? 0)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Pass Rate</span>
                  <span className="font-semibold tabular-nums">
                    {dashboard && (dashboard.passed + dashboard.rejected) > 0
                      ? ((dashboard.passed / (dashboard.passed + dashboard.rejected)) * 100).toFixed(1) + "%"
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Rate</span>
                  <span className="font-semibold tabular-nums">
                    {dashboard && dashboard.totalProduced > 0
                      ? ((dashboard.delivered / dashboard.totalProduced) * 100).toFixed(1) + "%"
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Recent Checks</h3>
            {checks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No checks yet</p>
            ) : (
              <div className="space-y-2">
                {checks.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      {(c as any).products?.name ?? "—"}
                    </span>
                    <span className="tabular-nums font-medium">
                      <span className="text-emerald-600">+{c.passed_qty}</span>
                      {c.rejected_qty > 0 && <span className="text-red-500 ml-1">-{c.rejected_qty}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
