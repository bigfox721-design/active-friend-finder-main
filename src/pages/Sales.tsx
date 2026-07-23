import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { todayISO } from "@/lib/format";
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
import { useProducts } from "@/hooks/useProduction";
import { useAccessories } from "@/hooks/useInventory";
import { useSales, useRecordSale } from "@/hooks/useSales";
import { useBranch } from "@/hooks/useBranch";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SubProductRow = {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
};

export default function SalesPage() {
  const { branchId, branches } = useBranch();
  const { data: products = [] } = useProducts();
  const { data: accessories = [] } = useAccessories();
  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SubProductRow[];
    },
  });

  const [filterCategory, setFilterCategory] = useState<"products" | "accessories">("products");
  const [filterDate, setFilterDate] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [filterSubProductId, setFilterSubProductId] = useState("");
  const [filterAccessoryId, setFilterAccessoryId] = useState("");

  const filterTargetId = useMemo(() => {
    if (filterCategory === "products") return filterSubProductId || filterProductId;
    return filterAccessoryId;
  }, [filterCategory, filterProductId, filterSubProductId, filterAccessoryId]);

  const filteredSubs = useMemo(
    () => (filterProductId ? subProducts.filter((s) => s.product_id === filterProductId) : []),
    [filterProductId, subProducts],
  );

  const { data: sales = [] } = useSales({
    date: filterDate || undefined,
    productId: filterTargetId || undefined,
  });
  const recordSale = useRecordSale();
  const { role } = useRole();

  const [category, setCategory] = useState<"products" | "accessories">("products");
  const [productId, setProductId] = useState("");
  const [subProductId, setSubProductId] = useState("");
  const [accessoryId, setAccessoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [referenceNo, setReferenceNo] = useState("");

  const formSubs = useMemo(
    () => (productId ? subProducts.filter((s) => s.product_id === productId) : []),
    [productId, subProducts],
  );

  const targetId = useMemo(() => {
    if (category === "products") return subProductId || productId;
    return accessoryId;
  }, [category, productId, subProductId, accessoryId]);

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "Current Branch";
  const isManager = role?.role === "manager";

  const { data: todayProdEntry } = useQuery({
    queryKey: ["entries", "sales-check", targetId],
    enabled: !!targetId && category === "products",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("production_entries")
        .select("target_qty, completed_qty")
        .eq("product_id", targetId)
        .eq("entry_date", todayISO())
        .maybeSingle();
      return data as { target_qty: number; completed_qty: number } | null;
    },
  });

  const { data: existingStock } = useQuery({
    queryKey: ["inventory-stock-check", targetId, branchId],
    enabled: !!targetId && category === "products",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inventory")
        .select("quantity")
        .eq("product_id", targetId)
        .eq("branch_id", branchId)
        .maybeSingle();
      return data as { quantity: number } | null;
    },
  });

  const productionCompleted = category === "accessories" || !targetId
    || (todayProdEntry && todayProdEntry.completed_qty > 0)
    || (existingStock && existingStock.quantity > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return toast.error("Select an item");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");

    try {
      await recordSale.mutateAsync({
        product_id: targetId,
        quantity: qty,
        reference_no: referenceNo || undefined,
      });
      toast.success("Sale recorded — stock updated");
      setProductId("");
      setSubProductId("");
      setAccessoryId("");
      setQuantity("");
      setReferenceNo("");
    } catch (e: any) {
      const msg = e?.message ?? "Failed to record sale";
      if (msg.includes("Insufficient stock") && isManager) {
        toast.error(msg, {
          duration: 8000,
          action: {
            label: "Override & Record",
            onClick: async () => {
              try {
                await recordSale.mutateAsync({
                  product_id: targetId,
                  quantity: qty,
                  reference_no: referenceNo || undefined,
                  override_approved_by: role!.id,
                });
                toast.success("Sale recorded with manager override");
                setProductId("");
                setSubProductId("");
                setAccessoryId("");
                setQuantity("");
                setReferenceNo("");
              } catch (e2: any) {
                toast.error(e2?.message ?? "Override failed");
              }
            },
          },
        });
      } else if (msg.includes("Insufficient stock")) {
        toast.error(msg + " (ask a manager to override)");
      } else {
        toast.error(msg);
      }
    }
  };

  const handleCategoryChange = (value: "products" | "accessories") => {
    setCategory(value);
    setProductId("");
    setSubProductId("");
    setAccessoryId("");
  };

  const handleFilterCategoryChange = (value: "products" | "accessories") => {
    setFilterCategory(value);
    setFilterProductId("");
    setFilterSubProductId("");
    setFilterAccessoryId("");
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Record sales for {branchName}</p>
        </div>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">Record a Sale</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {category === "products" ? (
            <>
              <div>
                <Label>Product</Label>
                <Select value={productId} onValueChange={(v) => { setProductId(v); setSubProductId(""); }}>
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
              {formSubs.length > 0 && (
                <div>
                  <Label>Sub Product</Label>
                  <Select value={subProductId} onValueChange={setSubProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {formSubs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div>
              <Label>Accessory</Label>
              <Select value={accessoryId} onValueChange={setAccessoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select accessory" />
                </SelectTrigger>
                <SelectContent>
                  {accessories.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty sold"
            />
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. INV-001"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={recordSale.isPending || (!productionCompleted && !!targetId && category === "products")} className="w-full">
              {recordSale.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              Record Sale
            </Button>
          </div>
          {!productionCompleted && targetId && category === "products" && (
            <p className="text-xs text-warning bg-warning/10 rounded-md px-3 py-2 w-full text-center">
              Complete production in Daily Overview first (set Evening Completed)
            </p>
          )}
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">Sale History</h2>
        <div className="flex gap-3 mb-4 flex-wrap">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={filterCategory} onValueChange={handleFilterCategoryChange}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-9" />
          </div>
          {filterCategory === "products" ? (
            <>
              <div>
                <Label className="text-xs">Product</Label>
                <Select value={filterProductId} onValueChange={(v) => { setFilterProductId(v); setFilterSubProductId(""); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filteredSubs.length > 0 && (
                <div>
                  <Label className="text-xs">Sub Product</Label>
                  <Select value={filterSubProductId} onValueChange={setFilterSubProductId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {filteredSubs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div>
              <Label className="text-xs">Accessory</Label>
              <Select value={filterAccessoryId} onValueChange={setFilterAccessoryId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All accessories" />
                </SelectTrigger>
                <SelectContent>
                  {accessories.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          {sales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales recorded yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm font-medium text-muted-foreground">
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Product</th>
                  <th className="text-right py-3 px-2">Quantity</th>
                  <th className="text-left py-3 px-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const isReversed = !!s.reversed_at;
                  return (
                    <tr key={s.id} className={`border-b last:border-0 ${isReversed ? "opacity-50" : ""}`}>
                      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(s.sale_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 font-medium">
                        {(s as any).products?.name ?? "—"}
                        {isReversed && <span className="ml-2 text-xs text-muted-foreground">(reversed)</span>}
                      </td>
                      <td className="py-3 px-2 text-right tabular-nums font-semibold text-red-600">
                        -{s.quantity}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {s.reference_no ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
