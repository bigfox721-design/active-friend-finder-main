import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts, useAddProduct, useDeleteProduct } from "@/hooks/useProduction";
import { useRole } from "@/hooks/useRole";
import { useCreateActivityLog } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type SubProduct = {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
};

export default function Products() {
  const { data: products = [] } = useProducts();
  const addProd = useAddProduct();
  const delProd = useDeleteProduct();
  const { role } = useRole();
  const logActivity = useCreateActivityLog();
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

  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("*")
        .order("created_at", { ascending: true });
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
  const cancelEditProduct = () => {
    setEditingProductId(null);
    setEditingProductName("");
    setEditingProductCode("");
  };

  const saveEditProduct = async (id: string) => {
    if (role?.role !== "manager") return toast.error("Only managers can edit products.");
    const trimmed = editingProductName.trim();
    if (trimmed.length < 2) return toast.error("Product name too short");
    if (trimmed.length > 60) return toast.error("Product name too long");
    const { error } = await (supabase as any)
      .from("products")
      .update({ name: trimmed, code: editingProductCode.trim() || null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product updated");
    logActivity.mutate({
      action: "product_updated",
      description: `Product "${trimmed}" updated`,
      product_id: id,
    });
    cancelEditProduct();
    refreshProds();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role?.role !== "manager") return toast.error("Only managers can add products.");
    if (name.trim().length < 2) return toast.error("Product name too short");
    if (name.length > 60) return toast.error("Product name too long");
    try {
      await addProd.mutateAsync(name);
      // fetch the just-added product by name (latest)
      const { data } = await (supabase as any)
        .from("products")
        .select("id")
        .eq("name", name)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (code.trim() && data?.id)
        await (supabase as any).from("products").update({ code: code.trim() }).eq("id", data.id);
      if (data?.id) refreshProds();
      toast.success(`Added ${name}`);
      logActivity.mutate({
        action: "product_created",
        description: `Product "${name.trim()}" created`,
        product_id: data?.id,
      });
      setName("");
      setCode("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addSub = async (productId: string) => {
    const n = (subName[productId] || "").trim();
    const c = (subCode[productId] || "").trim();
    if (n.length < 2) return toast.error("Sub-product name too short");
    const parentName = products.find((p: any) => p.id === productId)?.name ?? productId.slice(0, 8);
    const { error } = await (supabase as any)
      .from("sub_products")
      .insert({ product_id: productId, name: n, code: c || null });
    if (error) return toast.error(error.message);
    toast.success("Sub-product added");
    logActivity.mutate({
      action: "sub_product_created",
      description: `Sub-product "${n}" created under "${parentName}"`,
      product_id: productId,
    });
    setSubName({ ...subName, [productId]: "" });
    setSubCode({ ...subCode, [productId]: "" });
    refreshSubs();
  };

  const startEditSub = (s: SubProduct) => {
    setEditingSubId(s.id);
    setEditingSubName(s.name);
    setEditingSubCode(s.code ?? "");
  };
  const cancelEditSub = () => {
    setEditingSubId(null);
    setEditingSubName("");
    setEditingSubCode("");
  };
  const saveEditSub = async (id: string) => {
    const n = editingSubName.trim();
    if (n.length < 2) return toast.error("Sub-product name too short");
    const { error } = await (supabase as any)
      .from("sub_products")
      .update({ name: n, code: editingSubCode.trim() || null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sub-product updated");
    logActivity.mutate({
      action: "sub_product_updated",
      description: `Sub-product "${n}" updated`,
      product_id: id,
    });
    cancelEditSub();
    refreshSubs();
  };
  const deleteSub = async (id: string) => {
    const sub = subProducts.find((s) => s.id === id);
    const name = sub?.name ?? id.slice(0, 8);
    const parentName = sub
      ? (products.find((p: any) => p.id === sub.product_id)?.name ?? sub.product_id.slice(0, 8))
      : "Unknown";
    const { error } = await (supabase as any).from("sub_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sub-product deleted");
    logActivity.mutate({
      action: "sub_product_deleted",
      description: `Sub-product "${name}" deleted from "${parentName}"`,
      product_id: sub?.product_id,
    });
    refreshSubs();
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Products</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage products, product codes, and sub-products.
      </p>

      <Card className="glass rounded-2xl p-6">
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            placeholder="Product name (e.g. Frames)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <Input
            placeholder="Product code (e.g. CD123)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            className="sm:max-w-[200px]"
          />
          <Button
            type="submit"
            disabled={addProd.isPending || role?.role !== "manager"}
            className="bg-gradient-primary text-primary-foreground"
          >
            {addProd.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </form>

        <ul className="space-y-2">
          {products.map((p: any) => {
            const subs = subProducts.filter((s) => s.product_id === p.id);
            const isOpen = !!expanded[p.id];
            return (
              <li key={p.id} className="rounded-lg bg-secondary/40">
                <div className="flex items-center justify-between gap-2 p-3">
                  {editingProductId === p.id ? (
                    <>
                      <div className="flex-1 flex flex-col sm:flex-row gap-2">
                        <Input
                          autoFocus
                          value={editingProductName}
                          onChange={(e) => setEditingProductName(e.target.value)}
                          maxLength={60}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditProduct(p.id);
                            if (e.key === "Escape") cancelEditProduct();
                          }}
                          className="h-9"
                        />
                        <Input
                          value={editingProductCode}
                          onChange={(e) => setEditingProductCode(e.target.value)}
                          maxLength={40}
                          placeholder="Code"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditProduct(p.id);
                            if (e.key === "Escape") cancelEditProduct();
                          }}
                          className="h-9 sm:max-w-[180px]"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => saveEditProduct(p.id)}
                          disabled={role?.role !== "manager"}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEditProduct}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{p.name}</span>
                        {p.code && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            {p.code}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">· {p.unit}</span>
                        {subs.length > 0 && (
                          <span className="text-xs text-muted-foreground">({subs.length} sub)</span>
                        )}
                      </button>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditProduct(p)}
                          disabled={role?.role !== "manager"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => delProd.mutate(p.id)}
                          disabled={role?.role !== "manager"}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-border/40 p-3 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Sub-product name (e.g. Frames 1)"
                        value={subName[p.id] || ""}
                        onChange={(e) => setSubName({ ...subName, [p.id]: e.target.value })}
                        maxLength={60}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSub(p.id);
                        }}
                        className="h-9"
                      />
                      <Input
                        placeholder="Sub code"
                        value={subCode[p.id] || ""}
                        onChange={(e) => setSubCode({ ...subCode, [p.id]: e.target.value })}
                        maxLength={40}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSub(p.id);
                        }}
                        className="h-9 sm:max-w-[160px]"
                      />
                      <Button size="sm" onClick={() => addSub(p.id)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Sub
                      </Button>
                    </div>

                    <ul className="space-y-1">
                      {subs.map((s) => {
                          return (
                            <li key={s.id} className="rounded bg-background/40">
                              <div className="flex items-center justify-between gap-2 p-2">
                                {editingSubId === s.id ? (
                                  <>
                                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                      <Input
                                        autoFocus
                                        value={editingSubName}
                                        onChange={(e) => setEditingSubName(e.target.value)}
                                        maxLength={60}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditSub(s.id);
                                          if (e.key === "Escape") cancelEditSub();
                                        }}
                                        className="h-8"
                                      />
                                      <Input
                                        value={editingSubCode}
                                        onChange={(e) => setEditingSubCode(e.target.value)}
                                        maxLength={40}
                                        placeholder="Code"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditSub(s.id);
                                          if (e.key === "Escape") cancelEditSub();
                                        }}
                                        className="h-8 sm:max-w-[160px]"
                                      />
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => saveEditSub(s.id)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={cancelEditSub}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-sm flex items-center gap-2">
                                      {s.name}
                                      {s.code && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                                          {s.code}
                                        </span>
                                      )}
                                    </span>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => startEditSub(s)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => deleteSub(s.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      {!subs.length && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          No sub-products yet.
                        </p>
                      )}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
          {!products.length && (
            <p className="text-sm text-muted-foreground text-center py-6">No products yet.</p>
          )}
        </ul>
      </Card>
    </AppShell>
  );
}
