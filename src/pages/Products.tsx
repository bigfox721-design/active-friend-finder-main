import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts, useAddProduct, useDeleteProduct } from "@/hooks/useProduction";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Pencil, Check, X, ChevronDown, ChevronRight, Package } from "lucide-react";

type Material = { name: string; quantity_per_unit: number; unit: string };
type SubProduct = { id: string; product_id: string; name: string; code: string | null; materials: Material[] | null };

export default function Products() {
  const { data: products = [] } = useProducts();
  const addProd = useAddProduct();
  const delProd = useDeleteProduct();
  const qc = useQueryClient();

  // new product
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  // edit product
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductCode, setEditingProductCode] = useState("");

  // expand and sub-products
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subName, setSubName] = useState<Record<string, string>>({});
  const [subCode, setSubCode] = useState<Record<string, string>>({});
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState("");
  const [editingSubCode, setEditingSubCode] = useState("");

  // material draft per sub-product id
  const [matName, setMatName] = useState<Record<string, string>>({});
  const [matQty, setMatQty] = useState<Record<string, string>>({});
  const [matUnit, setMatUnit] = useState<Record<string, string>>({});

  // material draft per product id (used when product has no sub-products)
  const [pMatName, setPMatName] = useState<Record<string, string>>({});
  const [pMatQty, setPMatQty] = useState<Record<string, string>>({});
  const [pMatUnit, setPMatUnit] = useState<Record<string, string>>({});

  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sub_products").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as SubProduct[];
    },
  });

  const refreshSubs = () => qc.invalidateQueries({ queryKey: ["sub_products"] });
  const refreshProds = () => qc.invalidateQueries({ queryKey: ["products"] });

  const startEditProduct = (p: any) => {
    setEditingProductId(p.id);
    setEditingProductName(p.name);
    setEditingProductCode(p.code ?? "");
  };
  const cancelEditProduct = () => { setEditingProductId(null); setEditingProductName(""); setEditingProductCode(""); };

  const saveEditProduct = async (id: string) => {
    const trimmed = editingProductName.trim();
    if (trimmed.length < 2) return toast.error("Product name too short");
    if (trimmed.length > 60) return toast.error("Product name too long");
    const { error } = await (supabase as any).from("products").update({ name: trimmed, code: editingProductCode.trim() || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product updated");
    cancelEditProduct();
    refreshProds();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Product name too short");
    if (name.length > 60) return toast.error("Product name too long");
    try {
      await addProd.mutateAsync(name);
      // set code if provided — fetch the just-added product by name (latest)
      if (code.trim()) {
        const { data } = await (supabase as any).from("products").select("id").eq("name", name).order("created_at", { ascending: false }).limit(1).single();
        if (data?.id) await (supabase as any).from("products").update({ code: code.trim() }).eq("id", data.id);
        refreshProds();
      }
      toast.success(`Added ${name}`);
      setName(""); setCode("");
    } catch (err: any) { toast.error(err.message); }
  };

  const addSub = async (productId: string) => {
    const n = (subName[productId] || "").trim();
    const c = (subCode[productId] || "").trim();
    if (n.length < 2) return toast.error("Sub-product name too short");
    const { error } = await (supabase as any).from("sub_products").insert({ product_id: productId, name: n, code: c || null });
    if (error) return toast.error(error.message);
    toast.success("Sub-product added");
    setSubName({ ...subName, [productId]: "" });
    setSubCode({ ...subCode, [productId]: "" });
    refreshSubs();
  };

  const startEditSub = (s: SubProduct) => { setEditingSubId(s.id); setEditingSubName(s.name); setEditingSubCode(s.code ?? ""); };
  const cancelEditSub = () => { setEditingSubId(null); setEditingSubName(""); setEditingSubCode(""); };
  const saveEditSub = async (id: string) => {
    const n = editingSubName.trim();
    if (n.length < 2) return toast.error("Sub-product name too short");
    const { error } = await (supabase as any).from("sub_products").update({ name: n, code: editingSubCode.trim() || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sub-product updated");
    cancelEditSub();
    refreshSubs();
  };
  const deleteSub = async (id: string) => {
    const { error } = await (supabase as any).from("sub_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sub-product deleted");
    refreshSubs();
  };

  // Add a raw material to a specific sub-product (identified by product+sub index).
  const addMaterial = async (pIndex: number, sIndex: number) => {
    const product = products[pIndex];
    if (!product) return;
    const productSubs = subProducts.filter((s) => s.product_id === product.id);
    const sub = productSubs[sIndex];
    if (!sub) return;

    const mName = (matName[sub.id] || "").trim();
    const qty = parseFloat(matQty[sub.id] || "");
    const unit = (matUnit[sub.id] || "").trim();
    if (mName.length < 1) return toast.error("Material name required");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Quantity per unit must be > 0");
    if (unit.length < 1) return toast.error("Unit required (e.g. kg, pcs)");

    const current: Material[] = Array.isArray(sub.materials) ? sub.materials : [];
    const next: Material[] = [...current, { name: mName, quantity_per_unit: qty, unit }];

    const { error } = await (supabase as any)
      .from("sub_products").update({ materials: next }).eq("id", sub.id);
    if (error) return toast.error(error.message);

    toast.success(`Added ${mName} to ${sub.name}`);
    setMatName({ ...matName, [sub.id]: "" });
    setMatQty({ ...matQty, [sub.id]: "" });
    setMatUnit({ ...matUnit, [sub.id]: "" });
    refreshSubs();
  };

  const removeMaterial = async (subId: string, index: number) => {
    const sub = subProducts.find((s) => s.id === subId);
    if (!sub) return;
    const current: Material[] = Array.isArray(sub.materials) ? sub.materials : [];
    const next = current.filter((_, i) => i !== index);
    const { error } = await (supabase as any)
      .from("sub_products").update({ materials: next }).eq("id", subId);
    if (error) return toast.error(error.message);
    refreshSubs();
  };

  // Product-level materials (used when a product has no sub-products).
  const addProductMaterial = async (productId: string) => {
    const product: any = products.find((p: any) => p.id === productId);
    if (!product) return;
    const mName = (pMatName[productId] || "").trim();
    const qty = parseFloat(pMatQty[productId] || "");
    const unit = (pMatUnit[productId] || "").trim();
    if (mName.length < 1) return toast.error("Material name required");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Quantity per unit must be > 0");
    if (unit.length < 1) return toast.error("Unit required (e.g. kg, pcs)");

    const current: Material[] = Array.isArray(product.materials) ? product.materials : [];
    const next: Material[] = [...current, { name: mName, quantity_per_unit: qty, unit }];
    const { error } = await (supabase as any).from("products").update({ materials: next }).eq("id", productId);
    if (error) return toast.error(error.message);
    toast.success(`Added ${mName} to ${product.name}`);
    setPMatName({ ...pMatName, [productId]: "" });
    setPMatQty({ ...pMatQty, [productId]: "" });
    setPMatUnit({ ...pMatUnit, [productId]: "" });
    refreshProds();
  };

  const removeProductMaterial = async (productId: string, index: number) => {
    const product: any = products.find((p: any) => p.id === productId);
    if (!product) return;
    const current: Material[] = Array.isArray(product.materials) ? product.materials : [];
    const next = current.filter((_, i) => i !== index);
    const { error } = await (supabase as any).from("products").update({ materials: next }).eq("id", productId);
    if (error) return toast.error(error.message);
    refreshProds();
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Products</h1>
      <p className="text-muted-foreground text-sm mb-6">Manage products, product codes, and sub-products.</p>

      <Card className="glass rounded-2xl p-6">
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input placeholder="Product name (e.g. Frames)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <Input placeholder="Product code (e.g. CD123)" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} className="sm:max-w-[200px]" />
          <Button type="submit" disabled={addProd.isPending} className="bg-gradient-primary text-primary-foreground">
            {addProd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
          </Button>
        </form>

        <ul className="space-y-2">
          {products.map((p: any, pIndex: number) => {
            const subs = subProducts.filter((s) => s.product_id === p.id);
            const isOpen = !!expanded[p.id];
            return (
              <li key={p.id} className="rounded-lg bg-secondary/40">
                <div className="flex items-center justify-between gap-2 p-3">
                  {editingProductId === p.id ? (
                    <>
                      <div className="flex-1 flex flex-col sm:flex-row gap-2">
                        <Input autoFocus value={editingProductName} onChange={(e) => setEditingProductName(e.target.value)} maxLength={60}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEditProduct(p.id); if (e.key === "Escape") cancelEditProduct(); }} className="h-9" />
                        <Input value={editingProductCode} onChange={(e) => setEditingProductCode(e.target.value)} maxLength={40} placeholder="Code"
                          onKeyDown={(e) => { if (e.key === "Enter") saveEditProduct(p.id); if (e.key === "Escape") cancelEditProduct(); }} className="h-9 sm:max-w-[180px]" />
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => saveEditProduct(p.id)}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={cancelEditProduct}><X className="h-4 w-4" /></Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })} className="flex items-center gap-2 flex-1 text-left">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium">{p.name}</span>
                        {p.code && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{p.code}</span>}
                        <span className="text-xs text-muted-foreground">· {p.unit}</span>
                        {subs.length > 0 && <span className="text-xs text-muted-foreground">({subs.length} sub)</span>}
                      </button>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEditProduct(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => delProd.mutate(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-border/40 p-3 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input placeholder="Sub-product name (e.g. Frames 1)" value={subName[p.id] || ""} onChange={(e) => setSubName({ ...subName, [p.id]: e.target.value })} maxLength={60}
                        onKeyDown={(e) => { if (e.key === "Enter") addSub(p.id); }} className="h-9" />
                      <Input placeholder="Sub code" value={subCode[p.id] || ""} onChange={(e) => setSubCode({ ...subCode, [p.id]: e.target.value })} maxLength={40}
                        onKeyDown={(e) => { if (e.key === "Enter") addSub(p.id); }} className="h-9 sm:max-w-[160px]" />
                      <Button size="sm" onClick={() => addSub(p.id)}><Plus className="h-4 w-4 mr-1" />Sub</Button>
                    </div>

                    {/* Product-level materials — shown when this product has no sub-products */}
                    {subs.length === 0 && (() => {
                      const pMats: Material[] = Array.isArray((p as any).materials) ? (p as any).materials : [];
                      return (
                        <div className="rounded bg-background/40 px-3 py-2 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Package className="h-3 w-3" /> Raw materials (per 1 {p.unit || "unit"})
                          </div>
                          {pMats.length > 0 ? (
                            <ul className="space-y-1">
                              {pMats.map((m, i) => (
                                <li key={i} className="flex items-center justify-between text-xs bg-secondary/30 rounded px-2 py-1">
                                  <span>
                                    <span className="font-medium">{m.name}</span>
                                    <span className="ml-2 text-muted-foreground">{m.quantity_per_unit} {m.unit} / unit</span>
                                  </span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeProductMaterial(p.id, i)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">No materials yet.</p>
                          )}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input placeholder="Material (e.g. Steel)" value={pMatName[p.id] || ""}
                              onChange={(e) => setPMatName({ ...pMatName, [p.id]: e.target.value })} maxLength={60}
                              onKeyDown={(e) => { if (e.key === "Enter") addProductMaterial(p.id); }} className="h-8" />
                            <Input placeholder="Qty / unit" type="number" step="0.0001" min="0" value={pMatQty[p.id] || ""}
                              onChange={(e) => setPMatQty({ ...pMatQty, [p.id]: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") addProductMaterial(p.id); }} className="h-8 sm:max-w-[120px]" />
                            <Input placeholder="Unit (kg, pcs)" value={pMatUnit[p.id] || ""}
                              onChange={(e) => setPMatUnit({ ...pMatUnit, [p.id]: e.target.value })} maxLength={20}
                              onKeyDown={(e) => { if (e.key === "Enter") addProductMaterial(p.id); }} className="h-8 sm:max-w-[120px]" />
                            <Button size="sm" variant="secondary" onClick={() => addProductMaterial(p.id)}>
                              <Plus className="h-3 w-3 mr-1" />Material
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    <ul className="space-y-1">
                      {subs.map((s, sIndex) => {
                        const mats: Material[] = Array.isArray(s.materials) ? s.materials : [];
                        return (
                        <li key={s.id} className="rounded bg-background/40">
                          <div className="flex items-center justify-between gap-2 p-2">
                            {editingSubId === s.id ? (
                              <>
                                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                  <Input autoFocus value={editingSubName} onChange={(e) => setEditingSubName(e.target.value)} maxLength={60}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveEditSub(s.id); if (e.key === "Escape") cancelEditSub(); }} className="h-8" />
                                  <Input value={editingSubCode} onChange={(e) => setEditingSubCode(e.target.value)} maxLength={40} placeholder="Code"
                                    onKeyDown={(e) => { if (e.key === "Enter") saveEditSub(s.id); if (e.key === "Escape") cancelEditSub(); }} className="h-8 sm:max-w-[160px]" />
                                </div>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => saveEditSub(s.id)}><Check className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" onClick={cancelEditSub}><X className="h-4 w-4" /></Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-sm flex items-center gap-2">
                                  {s.name}
                                  {s.code && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{s.code}</span>}
                                  {mats.length > 0 && (
                                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                      <Package className="h-3 w-3" />{mats.length}
                                    </span>
                                  )}
                                </span>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => startEditSub(s)}><Pencil className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => deleteSub(s.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Materials section — stored inside THIS sub-product only */}
                          <div className="border-t border-border/40 px-3 py-2 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Package className="h-3 w-3" /> Raw materials (per 1 {p.unit || "unit"})
                            </div>
                            {mats.length > 0 ? (
                              <ul className="space-y-1">
                                {mats.map((m, i) => (
                                  <li key={i} className="flex items-center justify-between text-xs bg-secondary/30 rounded px-2 py-1">
                                    <span>
                                      <span className="font-medium">{m.name}</span>
                                      <span className="ml-2 text-muted-foreground">{m.quantity_per_unit} {m.unit} / unit</span>
                                    </span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeMaterial(s.id, i)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">No materials yet.</p>
                            )}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input placeholder="Material (e.g. Steel)" value={matName[s.id] || ""}
                                onChange={(e) => setMatName({ ...matName, [s.id]: e.target.value })} maxLength={60}
                                onKeyDown={(e) => { if (e.key === "Enter") addMaterial(pIndex, sIndex); }} className="h-8" />
                              <Input placeholder="Qty / unit" type="number" step="0.0001" min="0" value={matQty[s.id] || ""}
                                onChange={(e) => setMatQty({ ...matQty, [s.id]: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") addMaterial(pIndex, sIndex); }} className="h-8 sm:max-w-[120px]" />
                              <Input placeholder="Unit (kg, pcs)" value={matUnit[s.id] || ""}
                                onChange={(e) => setMatUnit({ ...matUnit, [s.id]: e.target.value })} maxLength={20}
                                onKeyDown={(e) => { if (e.key === "Enter") addMaterial(pIndex, sIndex); }} className="h-8 sm:max-w-[120px]" />
                              <Button size="sm" variant="secondary" onClick={() => addMaterial(pIndex, sIndex)}>
                                <Plus className="h-3 w-3 mr-1" />Material
                              </Button>
                            </div>
                          </div>
                        </li>
                        );
                      })}
                      {!subs.length && <p className="text-xs text-muted-foreground text-center py-2">No sub-products yet.</p>}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
          {!products.length && <p className="text-sm text-muted-foreground text-center py-6">No products yet.</p>}
        </ul>
      </Card>
    </AppShell>
  );
}
