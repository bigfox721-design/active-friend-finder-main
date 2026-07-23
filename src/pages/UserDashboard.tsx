import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { BranchSelector } from "@/components/BranchSelector";
import { ExportButtons } from "@/components/ExportButtons";
import { NotificationBell } from "@/components/NotificationBell";
import { useProducts, useEntries } from "@/hooks/useProduction";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/format";
import { Target, CheckCircle2, Percent, Loader2, Users } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

type SubProductRow = {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
  created_at: string;
};

export default function UserDashboard() {
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

  // Only show products/sub-products that have a target set today
  const productIdsWithTarget = useMemo(
    () => new Set(todayEntries.filter((e) => e.target_qty > 0).map((e) => e.product_id)),
    [todayEntries],
  );

  const stats = useMemo(() => {
    const t = todayEntries.reduce((s, e) => s + e.target_qty, 0);
    const c = todayEntries.reduce((s, e) => s + e.completed_qty, 0);
    const mp = todayEntries.reduce((s, e) => s + (e.manpower ?? 0), 0);
    return { t, c, mp, pct: t ? Math.round((c / t) * 100) : 0 };
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
            Production <span className="text-gradient">Overview</span>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {products
          .filter((p: any) => {
            const subs = subProducts.filter((s: SubProductRow) => s.product_id === p.id);
            return subs.length > 0
              ? subs.some((s) => productIdsWithTarget.has(s.id))
              : productIdsWithTarget.has(p.id);
          })
          .map((p: any) => {
          const subs = subProducts.filter((s: SubProductRow) => s.product_id === p.id);
          const entries =
            subs.length > 0
              ? subs
                  .filter((s: SubProductRow) => productIdsWithTarget.has(s.id))
                  .map((s: SubProductRow) => ({
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
                  entry: todayEntries.find((e) => e.product_id === s.id),
                }))
              : [{ product: p, entry: todayEntries.find((e) => e.product_id === p.id) }];
          return (
            <div key={p.id}>
              <h3 className="font-display text-lg font-bold mb-2">
                {p.name}
                {p.code && <span className="ml-2 text-xs text-muted-foreground">({p.code})</span>}
              </h3>
              {entries.map(({ product, entry }) => (
                <ProductCard key={product.id} product={product} entry={entry} standalone />
              ))}
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">
            No products available.
          </div>
        )}
      </div>

      
    </AppShell>
  );
}
