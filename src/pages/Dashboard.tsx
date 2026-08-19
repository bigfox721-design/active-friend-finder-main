import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";

import { KpiCard } from "@/components/KpiCard";
import { ExportButtons } from "@/components/ExportButtons";
import { BranchSelector } from "@/components/BranchSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import { useProducts, useEntries } from "@/hooks/useProduction";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, localISO } from "@/lib/format";
import type { Product } from "@/lib/types";

import { Target, CheckCircle2, AlertOctagon, Percent, Loader2, Users, Search } from "lucide-react";
import { sendMissedTargetAlert } from "@/lib/smtp.functions";

type SubProductRow = {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
  created_at: string;
};

export default function Dashboard() {
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
  // last 30 days for charts
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const { data: entries = [], isLoading: el } = useEntries({
    from: localISO(from),
    to: todayISO(),
  });

  const today = todayISO();
  const todayEntries = useMemo(
    () => entries.filter((e) => e.entry_date === today),
    [entries, today],
  );

  // Build list: if a product has sub-products, show product as a group header only
  // and render its sub-products. If no sub-products, render the product normally.
  type RenderItem =
    | { kind: "header"; product: Product }
    | { kind: "product"; product: Product; isSub: boolean };
  const productFilter: string | null = null;
  const subFilter: string | null = null;
  const [search, setSearch] = useState("");

  const renderItems = useMemo(() => {
    const items: RenderItem[] = [];
    const text = search.trim().toLowerCase();

    // Only show products that have a target set today
    const productIdsWithTarget = new Set(
      todayEntries.filter((e) => e.target_qty > 0).map((e) => e.product_id),
    );

    let filteredProducts = productFilter
      ? products.filter((p) => p.id === productFilter)
      : products;
    if (text) {
      filteredProducts = filteredProducts.filter((p) => {
        const productMatch =
          p.name.toLowerCase().includes(text) || (p.code ?? "").toLowerCase().includes(text);
        const subs = subProducts.filter((s) => s.product_id === p.id);
        const subMatch = subs.some(
          (s) => s.name.toLowerCase().includes(text) || (s.code ?? "").toLowerCase().includes(text),
        );
        return productMatch || subMatch;
      });
    }
    filteredProducts.forEach((p) => {
      let subs = subProducts.filter((s) => s.product_id === p.id);

      if (subFilter) subs = subs.filter((s) => s.id === subFilter);
      if (text) {
        const productMatch =
          p.name.toLowerCase().includes(text) || (p.code ?? "").toLowerCase().includes(text);
        if (!productMatch && subs.length > 0) {
          subs = subs.filter(
            (s) =>
              s.name.toLowerCase().includes(text) || (s.code ?? "").toLowerCase().includes(text),
          );
        }
      }

      // Only show sub-products that have a target today
      if (subs.length > 0) {
        const filteredSubs = subs.filter((s) => productIdsWithTarget.has(s.id));
        if (filteredSubs.length === 0) return;
        items.push({ kind: "header", product: p });
        filteredSubs.forEach((s) => {
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
          });
        });
      } else if (!subFilter && productIdsWithTarget.has(p.id)) {
        items.push({ kind: "header", product: p });
        items.push({ kind: "product", product: p, isSub: false });
      }
    });
    return items;
  }, [products, subProducts, productFilter, subFilter, search, todayEntries]);

  // Filter today's entries to match selection so KPIs reflect the chosen scope.
  const visibleProductIds = useMemo(
    () =>
      new Set(
        renderItems.filter((i) => i.kind === "product").map((i) => (i as any).product.id as string),
      ),
    [renderItems],
  );
  const filteredTodayEntries = useMemo(
    () =>
      productFilter || subFilter
        ? todayEntries.filter((e) => visibleProductIds.has(e.product_id))
        : todayEntries,
    [todayEntries, visibleProductIds, productFilter, subFilter],
  );

  const stats = useMemo(() => {
    const t = filteredTodayEntries.reduce((s, e) => s + e.target_qty, 0);
    const c = filteredTodayEntries.reduce((s, e) => s + e.completed_qty, 0);
    const mp = filteredTodayEntries.reduce((s, e) => s + (e.manpower ?? 0), 0);
    const missed = filteredTodayEntries.filter(
      (e) => e.target_qty > 0 && e.completed_qty < e.target_qty,
    ).length;
    return { t, c, mp, missed, pct: t ? Math.round((c / t) * 100) : 0 };
  }, [filteredTodayEntries]);

  const sendAlert = useServerFn(sendMissedTargetAlert);
  useEffect(() => {
    const notifOn = localStorage.getItem("bfp-notifications-enabled") === "true";
    if (!notifOn || stats.missed === 0) return;
    const lastSent = localStorage.getItem("bfp-alert-last-sent");
    const today = todayISO();
    if (lastSent === today) return;
    sendAlert()
      .then((r) => {
        if (r.sent) {
          localStorage.setItem("bfp-alert-last-sent", today);
        }
      })
      .catch(() => {});
  }, [stats.missed, sendAlert]);

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
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Live <span className="text-gradient">Production Pulse</span>
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
              products.map((p) => [p.id, { name: p.name, code: p.code }]),
            )}
          />
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Product / Subproduct / Code..."
          className="pl-9"
        />
      </div>

      {/* KPIs */}
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

      {/* Product entry cards */}
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
          const { product, isSub } = item;
          const e = todayEntries.find((x) => x.product_id === product.id);
          return (
            <div key={product.id}>
              <ProductCard product={product} entry={e} standalone={!isSub} />
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">
            No products yet. Add some in{" "}
            <a className="text-primary underline" href="/settings">
              Settings
            </a>
            .
          </div>
        )}
        {products.length > 0 && renderItems.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">
            No results found
          </div>
        )}
      </div>

      
    </AppShell>
  );
}
