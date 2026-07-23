import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { ExportButtons } from "@/components/ExportButtons";
import { BranchSelector } from "@/components/BranchSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import { useProducts, useEntries } from "@/hooks/useProduction";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/format";
import { Target, CheckCircle2, AlertOctagon, Percent, Loader2, Users, Search } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

type SubProductRow = {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
  created_at: string;
};

export default function ManagerDashboard() {
  const { data: products = [], isLoading: pl } = useProducts();
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
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const { data: entries = [], isLoading: el } = useEntries({
    from: from.toISOString().slice(0, 10),
    to: todayISO(),
  });
  const today = todayISO();
  const todayEntries = useMemo(
    () => entries.filter((e) => e.entry_date === today),
    [entries, today],
  );
  const [search, setSearch] = useState("");

  // Only show products/sub-products that have a target set today
  const productIdsWithTarget = useMemo(
    () => new Set(todayEntries.filter((e) => e.target_qty > 0).map((e) => e.product_id)),
    [todayEntries],
  );

  const renderItems = useMemo(() => {
    const items: Array<{ kind: "header" | "product"; product: any; isSub?: boolean }> = [];
    const text = search.trim().toLowerCase();
    let filtered = products;
    if (text) {
      filtered = filtered.filter((p: any) => {
        const pm =
          p.name.toLowerCase().includes(text) || (p.code ?? "").toLowerCase().includes(text);
        const subs = subProducts.filter((s: SubProductRow) => s.product_id === p.id);
        return (
          pm ||
          subs.some(
            (s) =>
              s.name.toLowerCase().includes(text) || (s.code ?? "").toLowerCase().includes(text),
          )
        );
      });
    }
    filtered.forEach((p: any) => {
      const subs = subProducts.filter((s: SubProductRow) => s.product_id === p.id);
      if (subs.length > 0) {
        const filteredSubs = subs.filter((s) => productIdsWithTarget.has(s.id));
        if (filteredSubs.length === 0) return;
        items.push({ kind: "header", product: p });
        filteredSubs.forEach((s: SubProductRow) =>
          items.push({
            kind: "product",
            product: {
              id: s.id,
              name: s.name,
              unit: p.unit,
              active: true,
              created_at: s.created_at,
              code: s.code,
              parent_id: p.id,
              is_sub: true,
            },
            isSub: true,
          }),
        );
      } else if (productIdsWithTarget.has(p.id)) {
        items.push({ kind: "header", product: p });
        items.push({ kind: "product", product: p, isSub: false });
      }
    });
    return items;
  }, [products, subProducts, search, productIdsWithTarget]);

  const stats = useMemo(() => {
    const t = todayEntries.reduce((s, e) => s + e.target_qty, 0);
    const c = todayEntries.reduce((s, e) => s + e.completed_qty, 0);
    const mp = todayEntries.reduce((s, e) => s + (e.manpower ?? 0), 0);
    const missed = todayEntries.filter(
      (e) => e.target_qty > 0 && e.completed_qty < e.target_qty,
    ).length;
    return { t, c, mp, missed, pct: t ? Math.round((c / t) * 100) : 0 };
  }, [todayEntries]);

  if (pl || el)
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Manager <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BranchSelector />
          <NotificationBell />
          <ExportButtons
            entries={entries}
            subProducts={subProducts}
            productsById={Object.fromEntries(
              products.map((p: any) => [p.id, { name: p.name, code: p.code }]),
            )}
          />
        </div>
      </div>

      <div className="mb-6 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Today's Target" value={stats.t} icon={Target} />
        <KpiCard
          label="Completed"
          value={stats.c}
          icon={CheckCircle2}
          tone={stats.c >= stats.t && stats.t > 0 ? "success" : "default"}
        />
        <KpiCard label="Total Manpower" value={stats.mp} icon={Users} />
        <KpiCard
          label="Achievement"
          value={`${stats.pct}%`}
          icon={Percent}
          tone={stats.pct >= 100 ? "success" : stats.pct >= 85 ? "warning" : "danger"}
        />
        <KpiCard
          label="Missed Targets"
          value={stats.missed}
          icon={AlertOctagon}
          tone={stats.missed > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {renderItems.map((item) => {
          if (item.kind === "header") {
            return (
              <div key={`h-${item.product.id}`} className="col-span-full mt-2">
                <h2 className="font-display text-2xl font-bold tracking-tight text-gradient">
                  {item.product.name}
                  {item.product.code && (
                    <span className="ml-2 text-sm text-muted-foreground font-normal">
                      ({item.product.code})
                    </span>
                  )}
                </h2>
              </div>
            );
          }
          const e = todayEntries.find((x) => x.product_id === item.product.id);
          return (
            <div key={item.product.id}>
              <ProductCard product={item.product} entry={e} standalone={!item.isSub} />
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">
            No products yet.
          </div>
        )}
      </div>

      
    </AppShell>
  );
}
