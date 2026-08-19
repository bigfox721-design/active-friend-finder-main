import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageTitle";
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
import {
  useMaterialTransfers,
  useCreateMaterialRequest,
  useFulfillMaterialRequest,
  useCancelMaterialRequest,
} from "@/hooks/useMaterialTransfer";
import { useRawMaterials, useReceiveRawMaterial } from "@/hooks/useRawMaterials";
import { Send, Download, Loader2, Package, Truck, X, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export default function MaterialTransferPage() {
  const { branchId, branches } = useBranch();
  const { data: rawMaterials = [] } = useRawMaterials();

  const { data: transfers = [], isLoading } = useMaterialTransfers();
  const requestMaterial = useCreateMaterialRequest();
  const fulfillRequest = useFulfillMaterialRequest();
  const cancelRequest = useCancelMaterialRequest();
  const receiveMaterial = useReceiveRawMaterial();

  const otherBranches = branches.filter((b) => b.id !== branchId);

  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [fromBranch, setFromBranch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const handleRequest = async () => {
    if (!selectedMaterial) return toast.error("Select a raw material");
    if (!fromBranch) return toast.error("Select the branch to request from");
    if (!branchId) return toast.error("No branch selected");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");

    try {
      await requestMaterial.mutateAsync({
        raw_material_id: selectedMaterial,
        quantity: qty,
        requesting_branch_id: branchId,
        requested_from_branch_id: fromBranch,
        notes: notes || undefined,
      });
      toast.success("Material request sent");
      setSelectedMaterial("");
      setFromBranch("");
      setQuantity("");
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send request");
    }
  };

  const handleFulfill = async (transferId: string) => {
    try {
      await fulfillRequest.mutateAsync(transferId);
      toast.success("Requested materials sent");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send materials");
    }
  };

  const handleCancel = async (transferId: string) => {
    try {
      await cancelRequest.mutateAsync(transferId);
      toast.success("Request cancelled");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel request");
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
      requested: "bg-orange-500/15 text-orange-600",
      pending: "bg-yellow-500/15 text-yellow-600",
      in_transit: "bg-blue-500/15 text-blue-600",
      completed: "bg-emerald-500/15 text-emerald-600",
      cancelled: "bg-destructive/15 text-destructive",
    };
    return m[s] ?? "bg-muted text-muted-foreground";
  };

  const statusText = (t: any) => {
    if (t.status === "requested") return "Requested";
    if (t.status === "in_transit") return "Sent to " + (t.dest?.name ?? "Branch");
    return t.status.replace("_", " ");
  };

  // Requests made TO this branch (this branch fulfills them).
  const requestsToFulfill = transfers.filter(
    (t: any) => t.source_branch_id === branchId && t.status === "requested",
  );
  // Requests this branch made (waiting on the other branch to send).
  const myRequests = transfers.filter(
    (t: any) => t.dest_branch_id === branchId && t.status === "requested",
  );
  // Materials sent to this branch waiting to be confirmed received.
  const toReceive = transfers.filter(
    (t: any) => t.dest_branch_id === branchId && t.status === "in_transit",
  );
  // Materials delivered to this branch (requests we made that were fulfilled).
  const receivedMaterials = transfers.filter(
    (t: any) => t.dest_branch_id === branchId && t.status === "completed",
  );

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <PageTitle>Material <span className="text-gradient">Request</span></PageTitle>
          <p className="text-sm text-muted-foreground">
            Request raw materials from other branches and fulfill incoming requests
          </p>
        </div>
      </div>

      {/* Request Form */}
      <Card className="p-5 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Send className="h-4 w-4" /> Request Raw Materials
        </h2>
        <form
          onSubmit={(e) => { e.preventDefault(); handleRequest(); }}
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
            <Label>From Branch</Label>
            <Select value={fromBranch} onValueChange={setFromBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Request from" />
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
            <Button type="submit" disabled={requestMaterial.isPending}>
              {requestMaterial.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Request Material
            </Button>
          </div>
        </form>
      </Card>

      {/* Requests To Fulfill */}
      {requestsToFulfill.length > 0 && (
        <Card className="p-5 mb-6 border-orange-500/30">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-orange-600">
            <Truck className="h-4 w-4" /> Requests To Fulfill
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsToFulfill.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                    <TableCell>{t.dest?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleFulfill(t.id)}
                          disabled={fulfillRequest.isPending}
                        >
                          {fulfillRequest.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Truck className="h-3 w-3 mr-1" />
                          )}
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(t.id)}
                          disabled={cancelRequest.isPending}
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* My Requests */}
      {myRequests.length > 0 && (
        <Card className="p-5 mb-6 border-blue-500/30">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-blue-600">
            <Send className="h-4 w-4" /> My Pending Requests
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested From</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                    <TableCell>{t.source?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(t.id)}
                        disabled={cancelRequest.isPending}
                      >
                        <X className="h-3 w-3 text-destructive" />
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* To Receive */}
      {toReceive.length > 0 && (
        <Card className="p-5 mb-6 border-blue-500/30">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-blue-600">
            <PackageCheck className="h-4 w-4" /> Confirm Material Receipt
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            The sending branch will be notified once you confirm receipt.
          </p>
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
                {toReceive.map((t: any) => (
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
                        Confirm Received
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Materials Received */}
      {receivedMaterials.length > 0 && (
        <Card className="p-5 mb-6 border-emerald-500/30">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-emerald-600">
            <PackageCheck className="h-4 w-4" /> Materials Received
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
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivedMaterials.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                    <TableCell>{t.source?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-emerald-500/15 text-emerald-600">
                        {t.received_at ? fmtDate(t.received_at) : "Completed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* All Requests */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">All Requests</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading requests...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested From</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No requests yet
                    </TableCell>
                  </TableRow>
                )}
                {transfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                    <TableCell>{t.dest?.name ?? "—"}</TableCell>
                    <TableCell>{t.source?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{t.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell>
                      <Badge className={statusBadge(t.status)} variant="outline">
                        {statusText(t)}
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
