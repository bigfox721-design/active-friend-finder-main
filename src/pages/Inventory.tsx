import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProduction";
import {
  useInventory,
  useAccessories,
  useAccessoryInventory,
  useSaveProductInventory,
  useSaveAccessoryInventory,
  useInventoryLogs,
} from "@/hooks/useInventory";
import { useUpsertStockEntry } from "@/hooks/useStockEntries";
import { useBranch } from "@/hooks/useBranch";
import { Package, Save, Loader2, History, ChevronDown, ChevronUp, TrendingDown } from "lucide-react";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

type SubProduct = { id: string; product_id: string; name: string; code: string | null };

export default function InventoryPage() {
  const { branchId, branches } = useBranch();
  const { data: products = [] } = useProducts();
  const { data: inventory = [] } = useInventory();
  const { data: accessories = [] } = useAccessories();
  const { data: accessoryInv = [] } = useAccessoryInventory();
  const saveProduct = useSaveProductInventory();
  const saveAccessory = useSaveAccessoryInventory();
  const saveStockEntry = useUpsertStockEntry();

  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products", "inventory"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("id, product_id, name, code");
      if (error) throw error;
      return data as SubProduct[];
    },
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["sales_7days", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sales_entries")
        .select("product_id, quantity")
        .gte("sale_date", sevenDaysAgo())
        .eq("branch_id", branchId);
      if (error) throw error;
      return data as { product_id: string; quantity: number }[];
    },
  });

  const salesAvg = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of recentSales) {
      map[s.product_id] = (map[s.product_id] ?? 0) + s.quantity;
    }
    for (const k of Object.keys(map)) {
      map[k] = map[k] / 7;
    }
    return map;
  }, [recentSales]);

  const [category, setCategory] = useState<"products" | "accessories">("products");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSubProduct, setSelectedSubProduct] = useState("");
  const [selectedAccessory, setSelectedAccessory] = useState("");
  const [planQty, setPlanQty] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [stockQty, setStockQty] = useState("");

  const filteredSubs = useMemo(
    () => (selectedProduct ? subProducts.filter((s) => s.product_id === selectedProduct) : []),
    [selectedProduct, subProducts],
  );

  const targetId = useMemo(() => {
    if (category === "products") return selectedSubProduct || selectedProduct;
    return selectedAccessory;
  }, [category, selectedProduct, selectedSubProduct, selectedAccessory]);

  const { data: todayProdEntry } = useQuery({
    queryKey: ["entries", "inventory-check", targetId],
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

  const { data: existingInv } = useQuery({
    queryKey: ["inv-stock-check", targetId],
    enabled: !!targetId && category === "products",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inventory")
        .select("quantity")
        .eq("product_id", targetId)
        .maybeSingle();
      return data as { quantity: number } | null;
    },
  });

  const productionCompleted = category === "accessories" || !targetId
    || (todayProdEntry && todayProdEntry.completed_qty > 0)
    || (existingInv && existingInv.quantity > 0);

  const [logsFilter, setLogsFilter] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const { data: logEntries = [] } = useInventoryLogs(
    logsFilter && showLogs ? logsFilter : undefined,
    200,
  );

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "Current Branch";

  const productName = useMemo(() => {
    if (!targetId || category !== "products") return null;
    const p = products.find((x) => x.id === targetId);
    if (p) return p.name;
    const s = subProducts.find((x) => x.id === targetId);
    return s?.name ?? null;
  }, [targetId, category, products, subProducts]);

  const handleSave = async () => {
    if (!targetId) return toast.error("Select an item");

    const plan = Number(planQty);
    const actual = Number(actualQty);
    const stock = Number(stockQty);
    if (!Number.isFinite(plan) || !Number.isFinite(actual) || !Number.isFinite(stock)) {
      return toast.error("Enter valid numbers");
    }

    try {
      if (category === "products") {
        const name = productName ?? "Unknown";
        await saveProduct.mutateAsync({
          product_id: targetId,
          product_name: name,
          plan_qty: plan,
          actual_complete_qty: actual,
          stock_qty: stock,
        });
        await saveStockEntry.mutateAsync({
          product_id: targetId,
          entry_date: todayISO(),
          plan_qty: plan,
          actual_complete_qty: actual,
          stock_qty: stock,
          category: "product",
        });
      } else {
        await saveAccessory.mutateAsync({
          accessory_id: targetId,
          plan_qty: plan,
          actual_complete_qty: actual,
          stock_qty: stock,
        });
        await saveStockEntry.mutateAsync({
          accessory_id: targetId,
          entry_date: todayISO(),
          plan_qty: plan,
          actual_complete_qty: actual,
          stock_qty: stock,
          category: "accessory",
        });
      }
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  };

  const handleItemSelect = (id: string) => {
    const inv = inventory.find((i) => i.product_id === id);
    const accInv = accessoryInv.find((a) => a.accessory_id === id);
    if (category === "products" && inv) {
      setPlanQty(String(inv.plan_qty));
      setActualQty(String(inv.actual_complete_qty));
      setStockQty(String(inv.quantity));
    } else if (category === "accessories" && accInv) {
      setPlanQty(String(accInv.plan_qty));
      setActualQty(String(accInv.actual_complete_qty));
      setStockQty(String(accInv.stock_qty));
    } else {
      setPlanQty("");
      setActualQty("");
      setStockQty("");
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">Monthly stock tracking for {branchName}</p>
        </div>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">Update Stock</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div>
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v: "products" | "accessories") => {
                setCategory(v);
                setSelectedProduct("");
                setSelectedSubProduct("");
                setSelectedAccessory("");
                setPlanQty("");
                setActualQty("");
                setStockQty("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {category === "products" && (
            <>
              <div>
                <Label>Product</Label>
                <Select
                  value={selectedProduct}
                  onValueChange={(v) => {
                    setSelectedProduct(v);
                    setSelectedSubProduct("");
                    handleItemSelect(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
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
                  onValueChange={(v) => {
                    setSelectedSubProduct(v);
                    if (v) handleItemSelect(v);
                  }}
                  disabled={!selectedProduct || filteredSubs.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedProduct && filteredSubs.length === 0 ? "No sub products" : "All"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No sub product</SelectItem>
                    {filteredSubs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {category === "accessories" && (
            <div>
              <Label>Accessory</Label>
              <Select
                value={selectedAccessory}
                onValueChange={(v) => {
                  setSelectedAccessory(v);
                  handleItemSelect(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select accessory" />
                </SelectTrigger>
                <SelectContent>
                  {accessories.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Target</Label>
            <Input
              type="number"
              min={0}
              value={planQty}
              onChange={(e) => setPlanQty(e.target.value)}
              placeholder="Planned qty"
            />
          </div>
          <div>
            <Label>Completed</Label>
            <Input
              type="number"
              min={0}
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
              placeholder="Completed qty"
            />
          </div>
          <div>
            <Label>Stock</Label>
            <Input
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              placeholder="Stock qty"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={saveProduct.isPending || saveAccessory.isPending || (!productionCompleted && !!targetId && category === "products")}
              className="w-full"
            >
              {(saveProduct.isPending || saveAccessory.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Add Inventory Entry
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
        <h2 className="text-base font-semibold mb-4">Current Inventory</h2>
        <div className="overflow-x-auto">
          {(() => {
            const prodRows = inventory
              .filter((i) => i.plan_qty > 0 || i.actual_complete_qty > 0 || i.quantity > 0)
              .map((i) => ({
                type: "Product" as const,
                product_id: i.product_id,
                name: i.product_name ?? "—",
                plan: i.plan_qty,
                actual: i.actual_complete_qty,
                stock: i.quantity,
                updated: i.updated_at,
              }));
            const accRows = accessoryInv
              .filter((a) => a.plan_qty > 0 || a.actual_complete_qty > 0 || a.stock_qty > 0)
              .map((a) => {
                const acc = accessories.find((x) => x.id === a.accessory_id);
                return {
                  type: "Accessory" as const,
                  name: acc?.name ?? "—",
                  plan: a.plan_qty,
                  actual: a.actual_complete_qty,
                  stock: a.stock_qty,
                  updated: a.updated_at,
                };
              });
            const allRows = [...prodRows, ...accRows];
            if (allRows.length === 0) {
              return (
                <p className="text-center text-muted-foreground py-8">No inventory records yet</p>
              );
            }
            return (
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm font-medium text-muted-foreground">
                    <th className="text-left py-3 px-2">Type</th>
                    <th className="text-left py-3 px-2">Name</th>
                    <th className="text-right py-3 px-2">Target</th>
                    <th className="text-right py-3 px-2">Completed</th>
                    <th className="text-right py-3 px-2">Stock</th>
                    <th className="text-right py-3 px-2">Forecast</th>
                    <th className="text-right py-3 px-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 px-2 text-sm text-muted-foreground">{r.type}</td>
                      <td className="py-3 px-2 font-medium">{r.name}</td>
                      <td className="py-3 px-2 text-right tabular-nums">{r.plan}</td>
                      <td className="py-3 px-2 text-right tabular-nums">{r.actual}</td>
                    <td className="py-3 px-2 text-right tabular-nums font-semibold">{r.stock}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-sm">
                      {(() => {
                        const pid = r.type === "Product" ? (r as any).product_id : null;
                        const avg = pid ? (salesAvg[pid] ?? 0) : 0;
                        if (!avg || avg <= 0 || r.stock <= 0) return <span className="text-muted-foreground">—</span>;
                        const days = Math.round(r.stock / avg);
                        const color = days <= 3 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-green-600";
                        return <span className={`font-medium ${color}`}>{days}d</span>;
                      })()}
                    </td>
                    <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                      {new Date(r.updated).toLocaleDateString()}
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </Card>

      <Card className="p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Stock Change History</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? (
              <><ChevronUp className="h-4 w-4 mr-1" /> Hide</>
            ) : (
              <><ChevronDown className="h-4 w-4 mr-1" /> Show</>
            )}
          </Button>
        </div>
        {showLogs && (
          <>
            <div className="mb-4">
              <Label>Filter by Product</Label>
              <Select value={logsFilter} onValueChange={setLogsFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All products</SelectItem>
                  {inventory.map((i) => (
                    <SelectItem key={i.id} value={i.product_id ?? ""}>
                      {i.product_name ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              {logEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No stock changes recorded yet</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm font-medium text-muted-foreground">
                      <th className="text-left py-3 px-2">Date</th>
                      <th className="text-left py-3 px-2">Product</th>
                      <th className="text-left py-3 px-2">Type</th>
                      <th className="text-right py-3 px-2">Change</th>
                      <th className="text-right py-3 px-2">Before</th>
                      <th className="text-right py-3 px-2">After</th>
                      <th className="text-left py-3 px-2">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logEntries.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 font-medium">{log.product_name ?? "—"}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.change_type === "SALE"
                              ? "bg-red-100 text-red-700"
                              : log.change_type === "PRODUCTION"
                                ? "bg-green-100 text-green-700"
                                : log.change_type === "TRANSFER"
                                  ? "bg-blue-100 text-blue-700"
                                  : log.change_type === "RETURN"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-gray-100 text-gray-700"
                          }`}>
                            {log.change_type}
                          </span>
                        </td>
                        <td className={`py-3 px-2 text-right tabular-nums font-medium ${
                          log.quantity_change < 0 ? "text-red-600" : "text-green-600"
                        }`}>
                          {log.quantity_change > 0 ? "+" : ""}{log.quantity_change}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums">{log.previous_stock}</td>
                        <td className="py-3 px-2 text-right tabular-nums font-semibold">{log.new_stock}</td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">{log.reference_id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
