import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/hooks/useBranch";
import { useMaterialTransfers } from "@/hooks/useMaterialTransfer";
import {
  useRawMaterials,
  useSendRawMaterial,
  useReceiveRawMaterial,
} from "@/hooks/useRawMaterials";
import { Send, Download, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export default function MaterialTransferPage() {
  const { branchId, branches } = useBranch();
  const { data: rawMaterials = [] } = useRawMaterials();

  const { data: transfers = [], isLoading } = useMaterialTransfers();
  const sendMaterial = useSendRawMaterial();
  const receiveMaterial = useReceiveRawMaterial();

  const otherBranches = branches.filter((b) => b.id !== branchId);

  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [destBranch, setDestBranch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const handleSend = async () => {
    if (!selectedMaterial) return toast.error("Select a raw material");
    if (!destBranch) return toast.error("Select destination branch");
    if (!branchId) return toast.error("No source branch selected");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");

    try {
      await sendMaterial.mutateAsync({
        raw_material_id: selectedMaterial,
        quantity: qty,
        source_branch_id: branchId,
        dest_branch_id: destBranch,
        notes: notes || undefined,
      });
      toast.success("Material sent");
      setSelectedMaterial("");
      setDestBranch("");
      setQuantity("");
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send material");
    }
  };

  const handleReceive = async (transferId: string) => {
    try {
      await receiveMaterial.mutateAsync(transferId);
      toast.success("Material received");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to receive material");
    }
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      pending: "bg-yellow-500/15 text-yellow-600",
      in_transit: "bg-blue-500/15 text-blue-600",
      completed: "bg-emerald-500/15 text-emerald-600",
      cancelled: "bg-destructive/15 text-destructive",
    };
    return m[s] ?? "bg-muted text-muted-foreground";
  };

  const incoming = transfers.filter(
    (t: any) => t.dest_branch_id === branchId && t.status === "in_transit",
  );

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Raw Material Transfer</h1>
          <p className="text-sm text-muted-foreground">
            Send and receive raw materials between branches
          </p>
        </div>
      </div>

      {/* Send Form */}
      <Card className="p-5 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Send className="h-4 w-4" /> Send Raw Materials
        </h2>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div>
            <Label>Raw Material</Label>
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {rawMaterials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>To Branch</Label>
            <Select value={destBranch} onValueChange={setDestBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent>
                {otherBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <div className="md:col-span-4">
            <Button type="submit" disabled={sendMaterial.isPending}>
              {sendMaterial.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to Branch
            </Button>
          </div>
        </form>
      </Card>

      {/* Incoming Transfers */}
      {incoming.length > 0 && (
        <Card className="p-5 mb-6 border-blue-500/30">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-blue-600">
            <Download className="h-4 w-4" /> Incoming Materials
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incoming.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                    <TableCell>{t.source?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleReceive(t.id)}
                        disabled={receiveMaterial.isPending}
                      >
                        {receiveMaterial.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Download className="h-3 w-3 mr-1" />
                        )}
                        Receive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* All Transfers */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">All Transfers</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading transfers...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No transfers yet
                    </TableCell>
                  </TableRow>
                )}
                {transfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                    <TableCell>{t.source?.name ?? "—"}</TableCell>
                    <TableCell>{t.dest?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell>
                      <Badge className={statusBadge(t.status)} variant="outline">
                        {t.status === "in_transit"
                          ? "Sent to " + (t.dest?.name ?? "Branch")
                          : t.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
