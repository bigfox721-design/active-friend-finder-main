import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProduction";
import { useBranch } from "@/hooks/useBranch";
import { useEditOverrides, useGrantOverride, useRevokeOverride } from "@/hooks/useOverride";
import { useCreateActivityLog } from "@/hooks/useActivityLog";
import { KeyRound, Shield, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AppUser = { id: string; name: string | null; email: string | null; role: string };
type SubProductRow = { id: string; product_id: string; name: string; code: string | null };

export default function ManagerOverridePage() {
  const { branchId } = useBranch();
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
  const { data: overrides = [], isLoading } = useEditOverrides();
  const grantOverride = useGrantOverride();
  const revokeOverride = useRevokeOverride();
  const createLog = useCreateActivityLog();

  const { data: users = [] } = useQuery({
    queryKey: ["all_users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("users")
        .select("id, name, email, role")
        .eq("role", "user");
      if (error) throw error;
      return data as AppUser[];
    },
  });

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSubProduct, setSelectedSubProduct] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [reason, setReason] = useState("");

  // Resolve a product id to a readable name, including sub-products.
  const getProductName = useMemo(() => {
    const map = new Map<string, string>();
    const parents = new Map<string, string>();
    for (const p of products) parents.set(p.id, p.name);
    for (const p of products) map.set(p.id, p.name);
    for (const s of subProducts) {
      const parent = parents.get(s.product_id);
      map.set(s.id, parent ? `${parent} — ${s.name}` : s.name);
    }
    return (id: string) => map.get(id) ?? id;
  }, [products, subProducts]);

  // Sub-products belonging to the currently selected product.
  const productSubProducts = useMemo(
    () => subProducts.filter((s) => s.product_id === selectedProduct),
    [subProducts, selectedProduct],
  );

  const handleGrant = async () => {
    if (!selectedUser) return toast.error("Select a user");
    const grantProductId = selectedSubProduct || selectedProduct;
    if (!grantProductId) return toast.error("Select a product or sub product");
    const hours = Number(expiresInHours);
    if (!Number.isFinite(hours) || hours <= 0) return toast.error("Enter valid hours");

    const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
    const userName = users.find((u) => u.id === selectedUser)?.name ?? "Unknown";
    const productName = getProductName(grantProductId);

    await grantOverride.mutateAsync({
      user_id: selectedUser,
      product_id: grantProductId,
      reason: reason || `Override granted for ${productName}`,
      expires_at: expiresAt,
    });

    await createLog.mutateAsync({
      branch_id: branchId ?? undefined,
      product_id: grantProductId,
      action: "override_granted",
      description: `Edit override granted to ${userName} for ${productName} (${hours}h)`,
    });

    toast.success(`Override granted to ${userName}`);
    setSelectedUser("");
    setSelectedProduct("");
    setSelectedSubProduct("");
    setReason("");
  };

  const handleRevoke = async (id: string) => {
    await revokeOverride.mutateAsync(id);
    toast.success("Override revoked");
  };

  const activeOverrides = useMemo(
    () => overrides.filter((o: any) => new Date(o.expires_at) > new Date()),
    [overrides],
  );

  const expiredOverrides = useMemo(
    () => overrides.filter((o: any) => new Date(o.expires_at) <= new Date()),
    [overrides],
  );

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <PageTitle>Manager <span className="text-gradient">Override</span></PageTitle>
          <p className="text-sm text-muted-foreground">
            Grant temporary edit access to users for specific products
          </p>
        </div>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Grant Override
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGrant();
          }}
          className="grid grid-cols-1 md:grid-cols-6 gap-4"
        >
          <div>
            <Label>User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email ?? u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Product</Label>
            <Select
              value={selectedProduct}
              onValueChange={(v) => {
                setSelectedProduct(v);
                setSelectedSubProduct("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No products
                  </SelectItem>
                )}
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sub Product</Label>
            <Select
              value={selectedSubProduct}
              disabled={!selectedProduct}
              onValueChange={setSelectedSubProduct}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedProduct ? "Select sub product" : "Select a product first"} />
              </SelectTrigger>
              <SelectContent>
                {productSubProducts.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No sub products for this product
                  </SelectItem>
                )}
                {productSubProducts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Expires in (hours)</Label>
            <Input
              type="number"
              min={1}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
            />
          </div>
          <div>
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={grantOverride.isPending} className="w-full">
              {grantOverride.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              Grant
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">Active Overrides</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOverrides.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No active overrides
                    </TableCell>
                  </TableRow>
                )}
                {activeOverrides.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.user?.name ?? "Unknown"}</TableCell>
                    <TableCell>{getProductName(o.product_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {new Date(o.expires_at).toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(o.id)}
                        disabled={revokeOverride.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {expiredOverrides.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground mt-6 mb-2 uppercase tracking-wider">
              Expired
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Expired At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredOverrides.map((o: any) => (
                    <TableRow key={o.id} className="opacity-60">
                      <TableCell>{o.user?.name ?? "Unknown"}</TableCell>
                      <TableCell>{getProductName(o.product_id)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(o.expires_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleRevoke(o.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
