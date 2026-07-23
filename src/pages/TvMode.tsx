import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEntries, useProducts } from "@/hooks/useProduction";
import { useInventory, useAccessories, useAccessoryInventory, InventoryLogEntry } from "@/hooks/useInventory";
import { useStockEntries } from "@/hooks/useStockEntries";
import { fmtNum, pct, statusOf, todayISO } from "@/lib/format";
import { ChartSwitcher } from "@/components/ChartSwitcher";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Maximize2,
  Minimize2,
  ArrowLeft,
  AlertOctagon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  X,
  Play,
  Square,
  Package,
} from "lucide-react";
import { Link } from "@/lib/router-shim";
import { cn } from "@/lib/utils";
import { BranchSelector } from "@/components/BranchSelector";
import { supabase } from "@/integrations/supabase/client";
import { getProductAndSubProduct } from "@/lib/product-mapping";

type SubProductRow = {
  id: string;
  product_id: string;
  name: string;
  code: string | null;
  created_at: string;
};

export default function TvMode() {
  const { data: products = [] } = useProducts();
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
  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, []);
  const monthEnd = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }, []);
  const { data: entries = [] } = useEntries({ from: monthStart, to: monthEnd });
  const { data: inventory = [] } = useInventory();
  const { data: accessories = [] } = useAccessories();
  const { data: accessoryInv = [] } = useAccessoryInventory();
  const { data: stockEntries = [] } = useStockEntries(monthStart, monthEnd);
  const { data: inventoryLogs = [] } = useQuery({
    queryKey: ["inventory_logs", "range", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_logs")
        .select("*")
        .gte("created_at", monthStart)
        .lte("created_at", `${monthEnd}T23:59:59Z`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as InventoryLogEntry[];
    },
  });
  const [tick, setTick] = useState(0);
  const [fs, setFs] = useState(false);

  // auto-refresh every 30s by re-rendering tick (queries cached but window focuses can refetch)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // TV Mode internal screens
  const slides = ["overview", "products", "monthly", "chart", "stocks", "stocks-monthly"] as const;
  type SlideKey = (typeof slides)[number];
  const slideLabels: Record<SlideKey, string> = {
    overview: "Production Overview",
    products: "Line Status",
    monthly: "Performance Metrics",
    chart: "Manpower View",
    stocks: "Stock Overview",
    "stocks-monthly": "Monthly Stock Overview",
  };

  // Settings (persisted)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSlides, setSelectedSlides] = useState<SlideKey[]>(() => {
    try {
      const raw = localStorage.getItem("tv-rotation-slides");
      if (raw) {
        const parsed = JSON.parse(raw) as SlideKey[];
        const filt = parsed.filter((s) => (slides as readonly string[]).includes(s));
        const missing = slides.filter((s) => !filt.includes(s));
        if (filt.length > 0) return [...filt, ...missing];
      }
    } catch {}
    return [...slides];
  });
  const [intervalSec, setIntervalSec] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    const v = Number(localStorage.getItem("tv-rotation-interval"));
    return v > 0 ? v : 5;
  });
  const [isRotating, setIsRotating] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem("tv-rotation-active");
    return raw == null ? true : raw === "true";
  });
  const [displayMode, setDisplayMode] = useState<"single" | "four">(() => {
    if (typeof window === "undefined") return "single";
    const raw = localStorage.getItem("tv-display-mode");
    return raw === "four" ? "four" : "single";
  });
  useEffect(() => {
    localStorage.setItem("tv-rotation-slides", JSON.stringify(selectedSlides));
  }, [selectedSlides]);
  useEffect(() => {
    localStorage.setItem("tv-rotation-interval", String(intervalSec));
  }, [intervalSec]);
  useEffect(() => {
    localStorage.setItem("tv-rotation-active", String(isRotating));
  }, [isRotating]);
  useEffect(() => {
    localStorage.setItem("tv-display-mode", displayMode);
  }, [displayMode]);

  const [slide, setSlide] = useState(0);
  const [pausedUntil, setPausedUntil] = useState(0);
  const [monthlyPageCount, setMonthlyPageCount] = useState(1);
  const [productsItemCount, setProductsItemCount] = useState(1);

  // Ensure current slide is part of selection
  useEffect(() => {
    if (selectedSlides.length === 0) return;
    const currentKey = slides[slide];
    if (!selectedSlides.includes(currentKey)) {
      const idx = slides.indexOf(selectedSlides[0]);
      setSlide(idx >= 0 ? idx : 0);
    }
  }, [selectedSlides, slide]);

  useEffect(() => {
    if (!isRotating || selectedSlides.length < 2) return;
    const baseMs = Math.max(1, intervalSec) * 1000;
    const isMonthly = slides[slide] === "monthly";
    const isProducts = slides[slide] === "products";
    const multiplier = isMonthly
      ? Math.max(1, monthlyPageCount)
      : isProducts
        ? Math.max(1, productsItemCount)
        : 1;
    const ms = baseMs * multiplier;
    const id = setInterval(() => {
      if (Date.now() < pausedUntil) return;
      setSlide((s) => {
        const order = selectedSlides.map((k) => slides.indexOf(k));
        const cur = order.indexOf(s);
        const nextIdx = order[(cur + 1) % order.length] ?? order[0];
        return nextIdx;
      });
    }, ms);
    return () => clearInterval(id);
  }, [
    pausedUntil,
    isRotating,
    intervalSec,
    selectedSlides,
    slide,
    displayMode,
    monthlyPageCount,
    productsItemCount,
  ]);

  const goTo = (i: number) => {
    setSlide(((i % slides.length) + slides.length) % slides.length);
    setPausedUntil(Date.now() + 30_000); // pause auto-rotate for 30s after manual change
  };
  const next = () => {
    if (selectedSlides.length === 0) return;
    const order = selectedSlides.map((k) => slides.indexOf(k));
    const cur = order.indexOf(slide);
    goTo(order[(cur + 1) % order.length] ?? order[0]);
  };
  const prev = () => {
    if (selectedSlides.length === 0) return;
    const order = selectedSlides.map((k) => slides.indexOf(k));
    const cur = order.indexOf(slide);
    goTo(order[(cur - 1 + order.length) % order.length] ?? order[0]);
  };

  const toggleSlide = (key: SlideKey) => {
    setSelectedSlides((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // at least one
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const startRotation = async () => {
    setIsRotating(true);
    setPausedUntil(0);
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setFs(true);
      } catch {}
    }
  };
  const stopRotation = () => setIsRotating(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide]);

  const today = todayISO();
  const todayEntries = useMemo(
    () => entries.filter((e) => e.entry_date === today),
    [entries, today, tick],
  );
  const totals = useMemo(() => {
    const t = todayEntries.reduce((s, e) => s + e.target_qty, 0);
    const c = todayEntries.reduce((s, e) => s + e.completed_qty, 0);
    const mp = todayEntries.reduce((s, e) => s + (e.manpower ?? 0), 0);
    const missed = todayEntries.filter(
      (e) => e.target_qty > 0 && e.completed_qty < e.target_qty,
    ).length;
    const eff = mp > 0 ? Math.round((c / mp) * 10) / 10 : 0;
    return { t, c, mp, eff, missed, pct: pct(c, t) };
  }, [todayEntries]);

  const anyMissed = totals.missed > 0;

  // Monthly matrix: for each product, day 1..daysInMonth with target & completed
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  // Build calendar weeks (Sun=0 ... Sat=6). Pad with nulls for blank cells.
  const firstDow = new Date(year, month, 1).getDay();
  const calendarCells: (number | null)[] = [...Array(firstDow).fill(null), ...days];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7));
  const dowLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const entryByKey = useMemo(() => {
    const m = new Map<string, { t: number; c: number }>();
    entries.forEach((e) =>
      m.set(`${e.product_id}|${e.entry_date}`, { t: e.target_qty, c: e.completed_qty }),
    );
    return m;
  }, [entries]);
  const dayKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const toggleFs = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setFs(true);
    } else {
      await document.exitFullscreen();
      setFs(false);
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen grid-bg p-6 md:p-10 relative overflow-hidden flex flex-col",
        anyMissed && "bg-destructive/20",
      )}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between mb-8">
        <Logo size="lg" />
        <div className="text-right">
          <div className="text-2xl md:text-4xl font-mono font-bold tabular-nums">
            <Clock />
          </div>
          <div className="text-sm uppercase tracking-widest text-foreground/80">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BranchSelector />
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFs}>
            {fs ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="TV rotation settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="glass rounded-2xl p-6 w-[92%] max-w-md border border-border shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-bold">TV Dashboard Rotation</h3>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                TV Screens
              </div>
              {slides.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary"
                    checked={selectedSlides.includes(key)}
                    onChange={() => toggleSlide(key)}
                  />
                  <span className="text-sm">{slideLabels[key]}</span>
                </label>
              ))}
              {selectedSlides.length === 0 && (
                <p className="text-xs text-destructive">Select at least one screen.</p>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Switch Interval (seconds)
              </label>
              <input
                type="number"
                min={1}
                value={intervalSec}
                onChange={(e) => setIntervalSec(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div className="mb-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                TV Display Mode
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="tv-display-mode"
                    className="h-4 w-4 accent-primary"
                    checked={displayMode === "single"}
                    onChange={() => setDisplayMode("single")}
                  />
                  <span className="text-sm">Standard Single Page</span>
                </label>
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="tv-display-mode"
                    className="h-4 w-4 accent-primary"
                    checked={displayMode === "four"}
                    onChange={() => setDisplayMode("four")}
                  />
                  <span className="text-sm">4 Products Per Page</span>
                </label>
              </div>
            </div>

            <div className="border-t border-border my-4" />

            <div className="flex gap-2">
              <Button
                onClick={startRotation}
                disabled={selectedSlides.length === 0 || intervalSec <= 0}
                className="flex-1 gap-2"
              >
                <Play className="h-4 w-4" /> Start Rotation
              </Button>
              <Button onClick={stopRotation} variant="secondary" className="flex-1 gap-2">
                <Square className="h-4 w-4" /> Stop Rotation
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {isRotating ? `Rotating every ${intervalSec}s` : "Rotation stopped"}
            </p>
          </div>
        </div>
      )}

      {/* Big KPIs — only on overview slide */}
      {slides[slide] === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <BigKpi label="Today's Target" value={fmtNum(totals.t)} />
          <BigKpi label="Completed" value={fmtNum(totals.c)} accent />
          <BigKpi label="Manpower" value={fmtNum(totals.mp)} />
          <BigKpi label="Per Worker" value={totals.mp > 0 ? totals.eff.toString() : "—"} />
          <BigKpi
            label="Achievement"
            value={`${totals.pct}%`}
            tone={totals.pct >= 100 ? "success" : totals.pct >= 85 ? "warning" : "danger"}
          />
        </div>
      )}

      {/* Rotating slide content */}
      <div
        className={cn(
          "overflow-hidden",
          displayMode === "four" && slides[slide] === "monthly"
            ? "flex-1 flex flex-col"
            : "min-h-[40vh]",
        )}
      >
        {slides[slide] === "overview" && (
          <div
            className={cn(
              "glass rounded-3xl p-10 text-center animate-fade-in",
              anyMissed && "animate-alert border-destructive",
            )}
          >
            {anyMissed ? (
              <>
                <AlertOctagon className="h-20 w-20 mx-auto text-destructive mb-4" />
                <h2 className="text-5xl md:text-7xl font-display font-bold text-destructive">
                  TARGET NOT REACHED
                </h2>
                <p className="mt-4 text-xl text-foreground/80">
                  {totals.missed} product{totals.missed > 1 ? "s" : ""} below today's target
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-20 w-20 mx-auto text-success mb-4" />
                <h2 className="text-5xl md:text-7xl font-display font-bold text-success">
                  ON TARGET
                </h2>
                <p className="mt-4 text-xl text-foreground/80">
                  Production pace looking strong — keep going!
                </p>
              </>
            )}
          </div>
        )}

        {slides[slide] === "products" && (
          <RotatingProducts
            products={products}
            subProducts={subProducts}
            todayEntries={todayEntries}
            onItemsCount={setProductsItemCount}
          />
        )}

        {slides[slide] === "chart" && (
          <div className="animate-fade-in">
            <ChartSwitcher entries={entries} title="30-day trend" defaultKind="line" />
          </div>
        )}

        {slides[slide] === "monthly" && (
          <div className={displayMode === "four" ? "flex-1 flex flex-col" : undefined}>
            <MonthlyTable
              products={products}
              subProducts={subProducts}
              days={days}
              year={year}
              month={month}
              monthLabel={monthLabel}
              entryByKey={entryByKey}
              dayKey={dayKey}
              today={now.getDate()}
              displayMode={displayMode}
              onPageCount={setMonthlyPageCount}
            />
          </div>
        )}

        {slides[slide] === "stocks" && (
          <StockOverview
            inventory={inventory}
            accessories={accessories}
            accessoryInv={accessoryInv}
            products={products}
          />
        )}

        {slides[slide] === "stocks-monthly" && (
          <MonthlyStockOverview
            stockEntries={stockEntries}
            inventory={inventory}
            accessoryInv={accessoryInv}
            products={products}
            accessories={accessories}
            inventoryLogs={inventoryLogs}
            days={days}
            year={year}
            month={month}
            monthLabel={monthLabel}
            dayKey={dayKey}
            today={now.getDate()}
            displayMode={displayMode}
            onPageCount={setMonthlyPageCount}
          />
        )}
      </div>

      {/* Manual navigation arrows */}
      <Button
        variant="ghost"
        size="icon"
        onClick={prev}
        aria-label="Previous slide"
        className="fixed left-4 top-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full glass hover:bg-primary/20"
      >
        <ChevronLeft className="h-7 w-7" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={next}
        aria-label="Next slide"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full glass hover:bg-primary/20"
      >
        <ChevronRight className="h-7 w-7" />
      </Button>

      {/* Slide indicators (clickable) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-2.5 rounded-full transition-all cursor-pointer hover:bg-primary/70",
              i === slide ? "w-10 bg-primary" : "w-3 bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

const Clock = () => {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      {t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </>
  );
};

const BigKpi = ({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "success" | "warning" | "danger";
}) => {
  const toneClass =
    tone === "success"
      ? "text-success border-success/40 shadow-glow-primary"
      : tone === "danger"
        ? "text-destructive border-destructive/40 animate-alert"
        : tone === "warning"
          ? "text-warning border-warning/40"
          : "";
  const len = value.length;
  // Container-query based scaling: font shrinks relative to the card width
  // (cqw = 1% of container width) so long values never overflow regardless of viewport.
  const fontSize =
    len <= 2
      ? "clamp(2.75rem, 38cqw, 7rem)"
      : len <= 4
        ? "clamp(2.25rem, 26cqw, 5.5rem)"
        : len <= 6
          ? "clamp(1.75rem, 18cqw, 4rem)"
          : len <= 8
            ? "clamp(1.5rem, 14cqw, 3rem)"
            : "clamp(1.25rem, 11cqw, 2.5rem)";
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 overflow-hidden flex flex-col items-center justify-center min-w-0",
        toneClass,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div className="text-xs md:text-sm uppercase tracking-widest text-muted-foreground text-center w-full truncate">
        {label}
      </div>
      <div
        className={cn(
          "font-display font-bold tabular-nums mt-2 leading-none text-center w-full max-w-full whitespace-nowrap overflow-hidden",
          accent && "text-gradient",
        )}
        style={{ fontSize }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}) => {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="min-w-[80px]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-xl md:text-2xl font-display font-bold tabular-nums leading-tight",
          toneClass,
        )}
      >
        {value}
      </div>
    </div>
  );
};

type RotItem = {
  id: string;
  name: string;
  parentName?: string;
  isSub: boolean;
  target: number;
  completed: number;
  manpower: number;
};

const RotatingProducts = ({
  products,
  subProducts,
  todayEntries,
  onItemsCount,
}: {
  products: { id: string; name: string; unit: string }[];
  subProducts: { id: string; product_id: string; name: string }[];
  todayEntries: {
    product_id: string;
    target_qty: number;
    completed_qty: number;
    manpower: number | null;
  }[];
  onItemsCount?: (count: number) => void;
}) => {
  const items = useMemo<RotItem[]>(() => {
    const list: RotItem[] = [];
    products.forEach((p) => {
      const subs = subProducts.filter((s) => s.product_id === p.id);
      if (subs.length > 0) {
        subs.forEach((s) => {
          const e = todayEntries.find((x) => x.product_id === s.id);
          list.push({
            id: s.id,
            name: s.name,
            parentName: p.name,
            isSub: true,
            target: e?.target_qty ?? 0,
            completed: e?.completed_qty ?? 0,
            manpower: e?.manpower ?? 0,
          });
        });
      } else {
        const e = todayEntries.find((x) => x.product_id === p.id);
        const { product, subProduct } = getProductAndSubProduct(p.name, null);
        const isSubVariant = subProduct !== "—";
        list.push({
          id: p.id,
          name: isSubVariant ? subProduct : product,
          parentName: isSubVariant ? product : undefined,
          isSub: isSubVariant,
          target: e?.target_qty ?? 0,
          completed: e?.completed_qty ?? 0,
          manpower: e?.manpower ?? 0,
        });
      }
    });
    return list.filter((item) => item.target > 0);
  }, [products, subProducts, todayEntries]);

  useEffect(() => {
    onItemsCount?.(items.length);
  }, [items.length, onItemsCount]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-rotate every 5s
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [items.length]);

  // Clamp index when items array shrinks
  useEffect(() => {
    if (currentIndex >= items.length && items.length > 0) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

  if (items.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-2xl text-foreground/70 uppercase tracking-widest">
          No products to display
        </p>
      </div>
    );
  }

  const current = items[currentIndex] ?? items[0];
  const achieved = current.target > 0 && current.completed >= current.target;
  const perWorker =
    current.manpower > 0 ? Math.round((current.completed / current.manpower) * 10) / 10 : 0;

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-5xl font-display font-extrabold uppercase tracking-wide text-gradient">
          Today's Product Record
        </h2>
        <p className="text-sm md:text-base text-foreground/70 mt-2 uppercase tracking-widest">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex justify-center">
        <div
          key={current.id}
          className={cn(
            "glass rounded-3xl p-10 md:p-14 w-full max-w-5xl animate-fade-in transition-all",
            achieved
              ? "border-2 border-green-500 shadow-lg shadow-green-500/30"
              : "border-2 border-red-500",
          )}
        >
          {/* Highlight badges */}
          <div className="flex justify-center mb-6">
            {achieved ? (
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-green-500/15 text-green-500 text-lg font-bold uppercase tracking-widest border border-green-500/40">
                🏆 Best Performer
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-red-500/15 text-red-500 text-lg font-bold uppercase tracking-widest border border-red-500/40">
                ⚠️ Needs Attention
              </span>
            )}
          </div>

          {/* Parent / category */}
          {current.parentName && (
            <p className="text-center text-lg uppercase tracking-[0.3em] text-foreground/60 mb-2">
              {current.parentName}
            </p>
          )}

          {/* Product name */}
          <h3 className="text-3xl md:text-5xl font-display font-bold text-center mb-10">
            {current.name}
          </h3>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="text-lg uppercase tracking-widest text-foreground/70 mb-2">
                Target
              </div>
              <div className="text-5xl font-bold tabular-nums">{fmtNum(current.target)}</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-lg uppercase tracking-widest text-foreground/70 mb-2">
                Completed
              </div>
              <div
                className={cn(
                  "text-5xl font-bold tabular-nums",
                  achieved ? "text-green-500" : "text-red-500",
                )}
              >
                {fmtNum(current.completed)}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-lg uppercase tracking-widest text-foreground/70 mb-2">
                Manpower
              </div>
              <div className="text-5xl font-bold tabular-nums">{fmtNum(current.manpower)}</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-lg uppercase tracking-widest text-foreground/70 mb-2">
                Per Worker
              </div>
              <div className="text-5xl font-bold tabular-nums">
                {current.manpower > 0 ? perWorker : "—"}
              </div>
            </div>
          </div>

          {/* Progress indicator dots */}
          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {items.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === currentIndex ? "w-8 bg-primary" : "w-2 bg-muted",
                )}
              />
            ))}
          </div>
          <div className="text-center text-sm text-foreground/60 mt-3 uppercase tracking-widest tabular-nums">
            {currentIndex + 1} / {items.length}
          </div>
        </div>
      </div>
    </div>
  );
};

type DayVal = { t: number; c: number };

type DetailRow = {
  productName: string;
  subName: string | null;
  target: number;
  completed: number;
  manpower: number;
};

const ProductDailyDetails = ({
  products,
  subProducts,
  todayEntries,
}: {
  products: { id: string; name: string; unit: string }[];
  subProducts: { id: string; product_id: string; name: string }[];
  todayEntries: {
    product_id: string;
    target_qty: number;
    completed_qty: number;
    manpower: number | null;
  }[];
}) => {
  const rows = useMemo<DetailRow[]>(() => {
    const list: DetailRow[] = [];
    products.forEach((p) => {
      const subs = subProducts.filter((s) => s.product_id === p.id);
      if (subs.length > 0) {
        subs.forEach((s) => {
          const e = todayEntries.find((x) => x.product_id === s.id);
          list.push({
            productName: p.name,
            subName: s.name,
            target: e?.target_qty ?? 0,
            completed: e?.completed_qty ?? 0,
            manpower: e?.manpower ?? 0,
          });
        });
      } else {
        const e = todayEntries.find((x) => x.product_id === p.id);
        list.push({
          productName: p.name,
          subName: null,
          target: e?.target_qty ?? 0,
          completed: e?.completed_qty ?? 0,
          manpower: e?.manpower ?? 0,
        });
      }
    });
    // Normalize so flat product entries (e.g. "Sframes" stored as a top-level
    // product) bucket under the correct parent ("Frames").
    const normalized = list.map((r) => {
      const { product, subProduct } = getProductAndSubProduct(r.productName, r.subName);
      return { ...r, productName: product, subName: subProduct === "—" ? null : subProduct };
    });
    normalized.sort((a, b) => a.productName.localeCompare(b.productName));
    return normalized;
  }, [products, subProducts, todayEntries]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-4xl font-display font-extrabold tracking-wide uppercase text-gradient">
          Product Daily Details
        </h2>
        <p className="text-xs md:text-sm text-foreground/70 mt-1 uppercase tracking-[0.25em]">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="glass rounded-2xl overflow-hidden border-2 border-border shadow-glow-primary">
        <table className="table-fixed w-full border-collapse tabular-nums">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr className="bg-primary/15 border-b-2 border-primary/40">
              {["Product", "Sub Product", "Target", "Completed", "Manpower", "Per Worker"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-center text-sm md:text-base font-bold uppercase tracking-wider border-r border-border last:border-r-0 leading-tight"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const perWorker =
                r.manpower > 0 ? Math.round((r.completed / r.manpower) * 10) / 10 : null;
              const showProductName = i === 0 || rows[i - 1].productName !== r.productName;
              return (
                <tr key={i} className="border-t border-border/50 hover:bg-primary/5 h-9">
                  <td className="px-2 py-1.5 text-center text-[13px] md:text-sm font-semibold border-r border-border/40 truncate leading-tight">
                    {showProductName ? r.productName : ""}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[13px] md:text-sm border-r border-border/40 truncate leading-tight">
                    {r.subName ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[13px] md:text-sm border-r border-border/40 leading-tight">
                    {fmtNum(r.target)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[13px] md:text-sm font-bold border-r border-border/40 leading-tight">
                    {fmtNum(r.completed)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[13px] md:text-sm border-r border-border/40 leading-tight">
                    {fmtNum(r.manpower)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[13px] md:text-sm leading-tight">
                    {perWorker !== null ? perWorker : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                  No products configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MonthlyTable = ({
  products,
  subProducts,
  days,
  year,
  month,
  monthLabel,
  entryByKey,
  dayKey,
  today,
  displayMode,
  onPageCount,
}: {
  products: { id: string; name: string; unit: string }[];
  subProducts: { id: string; product_id: string; name: string }[];
  days: number[];
  year: number;
  month: number;
  monthLabel: string;
  entryByKey: Map<string, DayVal>;
  dayKey: (d: number) => string;
  today: number;
  displayMode: "single" | "four";
  onPageCount?: (count: number) => void;
}) => {
  const dowShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Expand: one row per sub-product, or one row per product if no sub-products
  const expandedRaw = products.flatMap((p) => {
    const subs = subProducts.filter((s) => s.product_id === p.id);
    if (subs.length > 0) {
      return subs.map((s) => ({ id: s.id, productName: p.name, subName: s.name }));
    }
    return [{ id: p.id, productName: p.name, subName: null as string | null }];
  });
  const expanded = expandedRaw
    .map((r) => {
      const { product, subProduct } = getProductAndSubProduct(r.productName, r.subName);
      return { ...r, productName: product, subName: subProduct === "—" ? null : subProduct };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));

  const rows = expanded.map((r) => {
    let totalT = 0,
      totalC = 0,
      daysWithTarget = 0,
      daysReached = 0;
    const cells = days.map((d) => {
      const v = entryByKey.get(`${r.id}|${dayKey(d)}`) || { t: 0, c: 0 };
      totalT += v.t;
      totalC += v.c;
      if (v.t > 0) {
        daysWithTarget++;
        if (v.c >= v.t) daysReached++;
      }
      return v;
    });
    const achievement = totalT > 0 ? (totalC / totalT) * 100 : 0;
    const status =
      totalT === 0
        ? "Not Achieved"
        : achievement >= 100
          ? "Achieved"
          : achievement >= 70
            ? "Moderate"
            : "Not Achieved";
    return { ...r, cells, totalT, totalC, achievement, status, daysReached, daysWithTarget };
  });

  // TV Display Mode: Standard Single Page or 4 Products Per Page
  const PAGE_SIZE = displayMode === "four" ? 4 : rows.length;
  const totalPages = displayMode === "single" ? 1 : Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    onPageCount?.(totalPages);
  }, [totalPages, onPageCount]);
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => setPageIndex((p) => (p + 1) % totalPages), 5000);
    return () => clearInterval(id);
  }, [totalPages]);
  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [pageIndex, totalPages]);
  const safePageIndex = pageIndex >= totalPages ? 0 : pageIndex;
  const currentPageData =
    rows.length === 0
      ? []
      : rows
          .slice(safePageIndex * PAGE_SIZE, safePageIndex * PAGE_SIZE + PAGE_SIZE)
          .map((r) => ({ r, originalIdx: rows.indexOf(r) }));

  // Footer summary (entire month, all products)
  const grandTotal = rows.reduce((s, r) => s + r.totalC, 0);
  const dailyTotals = days.map((_, i) => rows.reduce((s, r) => s + (r.cells[i]?.c || 0), 0));
  const activeDays = dailyTotals.filter((v) => v > 0).length;
  const dailyAvg = activeDays > 0 ? grandTotal / activeDays : 0;
  let highestDay = 0,
    lowestDay = 0,
    highestVal = -1,
    lowestVal = Infinity;
  dailyTotals.forEach((v, i) => {
    if (v > highestVal) {
      highestVal = v;
      highestDay = days[i];
    }
    if (v > 0 && v < lowestVal) {
      lowestVal = v;
      lowestDay = days[i];
    }
  });
  if (lowestVal === Infinity) lowestVal = 0;

  // Per-day status counts (across all product/day pairs that have a target)
  let cA = 0,
    cM = 0,
    cN = 0,
    cTotalCells = 0;
  rows.forEach((r) =>
    r.cells.forEach((v) => {
      if (v.t <= 0) return;
      cTotalCells++;
      const ach = (v.c / v.t) * 100;
      if (ach >= 100) cA++;
      else if (ach >= 70) cM++;
      else cN++;
    }),
  );
  const pctOf = (n: number) => (cTotalCells > 0 ? ((n / cTotalCells) * 100).toFixed(1) : "0.0");

  const dateLabel = (d: number) => {
    const dow = new Date(year, month, d).getDay();
    return { d: String(d).padStart(2, "0"), dow: dowShort[dow] };
  };

  const cellTone = (v: DayVal) => {
    if (v.t <= 0 && v.c <= 0) return "bg-muted/10 text-muted-foreground/60";
    if (v.t <= 0) return "bg-muted/20 text-foreground";
    const a = (v.c / v.t) * 100;
    if (a >= 100) return "bg-success/30 text-success-foreground dark:text-success font-extrabold";
    if (a >= 70) return "bg-warning/30 text-warning-foreground dark:text-warning font-extrabold";
    return "bg-destructive/30 text-destructive-foreground dark:text-destructive font-extrabold";
  };

  const statusBadge = (s: string) => {
    if (s === "Achieved") return "bg-success text-success-foreground";
    if (s === "Moderate") return "bg-warning text-warning-foreground";
    return "bg-destructive text-destructive-foreground";
  };

  const rowH = displayMode === "four" ? 30 : 16;
  const isFour = displayMode === "four";

  // Dynamic row height for single mode — fit all products without scroll
  const [dynRowH, setDynRowH] = useState(rowH);
  const totalBodyRows = rows.length * 2;
  useLayoutEffect(() => {
    if (!isFour) {
      // single mode: calculate cell height from viewport
      const overhead = 220; // title + subtitle + header + legend + padding
      const h = Math.max(10, Math.min(24, (window.innerHeight - overhead) / totalBodyRows));
      setDynRowH(Math.round(h));
    } else {
      setDynRowH(rowH);
    }
  }, [isFour, rowH, totalBodyRows]);

  return (
    <div
      className={cn(
        "animate-fade-in",
        isFour ? "flex flex-col justify-center h-full space-y-2" : "space-y-4",
      )}
    >
      {/* Title */}
      <div className="text-center">
        <h2
          className={cn(
            "font-display font-extrabold tracking-wide uppercase text-gradient",
            isFour ? "text-2xl md:text-3xl" : "text-xl md:text-2xl",
          )}
        >
          Product Daily Details
        </h2>
        <p
          className={cn(
            "text-foreground/70 mt-1 uppercase tracking-[0.25em]",
            isFour ? "text-xs" : "text-[10px]",
          )}
        >
          {monthLabel}
        </p>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden border-2 border-border shadow-glow-primary">
        <div
          className="w-full"
          style={displayMode === "single" ? { containerType: "inline-size" } : undefined}
        >
          <table
            className={cn(
              "w-full border-collapse tabular-nums",
              isFour ? "text-[9px]" : "text-[7px]",
            )}
          >
            <colgroup>
              <col style={{ width: "3%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "5%" }} />
              {days.map((d) => (
                <col key={d} style={{ width: `${61 / days.length}%` }} />
              ))}
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
            </colgroup>
            <thead>
              <tr className="bg-primary/15 border-b-2 border-primary/40">
                <th
                  rowSpan={2}
                  className={cn(
                    "bg-card border-r-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  S.No
                </th>
                <th
                  rowSpan={2}
                  className={cn(
                    "bg-card border-r-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  Product
                </th>
                <th
                  rowSpan={2}
                  className={cn(
                    "bg-card border-r-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  Sub Product
                </th>
                <th
                  rowSpan={2}
                  className={cn(
                    "border-r-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  Metric
                </th>
                <th
                  colSpan={days.length}
                  className={cn(
                    "border-b-2 border-primary/40 text-center font-bold uppercase tracking-[0.2em] text-primary",
                    isFour ? "px-2 py-0.5 text-[9px]" : "px-2 py-0.5 text-[7px]",
                  )}
                >
                  {monthLabel}
                </th>
                <th
                  rowSpan={2}
                  className={cn(
                    "border-l-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  Total
                  <br />
                  Output
                </th>
                <th
                  rowSpan={2}
                  className={cn(
                    "border-l-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  Achv
                  <br />%
                </th>
                <th
                  rowSpan={2}
                  className={cn(
                    "border-l-2 border-border text-center font-bold uppercase px-1 leading-tight",
                    isFour ? "py-1 text-[10px]" : "py-1 text-[7px]",
                  )}
                >
                  Status
                </th>
              </tr>
              <tr className="bg-card/80 border-b-2 border-border">
                {days.map((d) => {
                  const lbl = dateLabel(d);
                  const isToday = d === today;
                  const dow = new Date(year, month, d).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th
                      key={d}
                      className={cn(
                        "p-0 border-r border-border/40 text-center font-bold overflow-hidden",
                        isWeekend && "bg-muted/30 text-muted-foreground",
                        isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      <div
                        className="flex flex-col items-center justify-center"
                        style={{
                          height: isFour ? "32px" : "auto",
                          aspectRatio: isFour ? undefined : "1",
                        }}
                      >
                        <div className={cn("leading-none", isFour && "text-[9px]")}>{lbl.d}</div>
                        <div
                          className={cn(
                            "font-medium leading-tight mt-0.5 uppercase",
                            isFour ? "text-[8px]" : "text-[7px] md:text-[8px]",
                            isToday ? "text-primary-foreground/90" : "text-muted-foreground",
                          )}
                        >
                          {lbl.dow}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {currentPageData.map(({ r, originalIdx }) => (
                <FragmentRow
                  key={r.id}
                  idx={originalIdx + 1}
                  name={
                    originalIdx === 0 || rows[originalIdx - 1].productName !== r.productName
                      ? r.productName
                      : ""
                  }
                  subName={r.subName}
                  cells={r.cells}
                  totalC={r.totalC}
                  achievement={r.achievement}
                  status={r.status}
                  cellTone={cellTone}
                  statusBadge={statusBadge}
                  today={today}
                  days={days}
                  compact={true}
                  rowH={dynRowH}
                />
              ))}
              {currentPageData.length === 0 && (
                <tr>
                  <td colSpan={days.length + 6} className="text-center text-muted-foreground py-8">
                    No products configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFour && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "inline-block rounded-full transition-all",
                i === safePageIndex ? "bg-primary h-2 w-4" : "bg-muted h-2 w-2",
              )}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-center gap-6 font-semibold",
          isFour ? "text-xs" : "text-[9px]",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className={cn("inline-block rounded-sm bg-success", isFour ? "h-3 w-3" : "h-2 w-2")}
          />{" "}
          Achieved
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={cn("inline-block rounded-sm bg-warning", isFour ? "h-3 w-3" : "h-2 w-2")}
          />{" "}
          Moderate
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={cn("inline-block rounded-sm bg-destructive", isFour ? "h-3 w-3" : "h-2 w-2")}
          />{" "}
          Not Achieved
        </span>
      </div>
    </div>
  );
};

const FragmentRow = ({
  idx,
  name,
  subName,
  cells,
  totalC,
  achievement,
  status,
  cellTone,
  statusBadge,
  today,
  days,
  compact,
  rowH = 16,
}: {
  idx: number;
  name: string;
  subName: string | null;
  cells: DayVal[];
  totalC: number;
  achievement: number;
  status: string;
  cellTone: (v: DayVal) => string;
  statusBadge: (s: string) => string;
  today: number;
  days: number[];
  compact?: boolean;
  rowH?: number;
}) => {
  const cellFont = rowH <= 16 ? "7px" : rowH >= 30 ? "9px" : "8px";
  const labelFont = rowH <= 16 ? "6px" : rowH >= 30 ? "8px" : "7px";
  const nameFont = rowH <= 16 ? "8px" : rowH >= 30 ? "11px" : "9px";
  const numFont = rowH <= 16 ? "8px" : rowH >= 30 ? "11px" : "9px";

  return (
    <>
      <tr
        className="border-t-2 border-border hover:bg-primary/5 transition-colors"
        style={{ height: `${rowH}px` }}
      >
        <td
          rowSpan={2}
          className={cn(
            "bg-card p-0 border-r-2 border-border text-center font-bold text-primary",
            compact ? "text-[9px]" : "text-sm",
          )}
        >
          {idx}
        </td>
        <td
          rowSpan={2}
          className="bg-card p-0 border-r-2 border-border text-center font-bold truncate"
        >
          <div className="px-0.5 truncate" style={{ fontSize: nameFont }}>
            {name}
          </div>
        </td>
        <td
          rowSpan={2}
          className="bg-card p-0 border-r-2 border-border text-center font-bold truncate"
        >
          <div className="px-0.5 truncate" style={{ fontSize: nameFont }}>
            {subName ?? "—"}
          </div>
        </td>
        <td
          className={cn(
            "p-0 border-r-2 border-border text-center text-muted-foreground font-bold uppercase tracking-wider bg-muted/20",
          )}
          style={{ fontSize: labelFont }}
        >
          <div className="flex items-center justify-center" style={{ height: `${rowH}px` }}>
            Target
          </div>
        </td>
        {cells.map((v, i) => (
          <td
            key={i}
            className={cn(
              "p-0 text-center font-semibold text-foreground/80 overflow-hidden border-0",
              days[i] === today && "bg-primary/15",
            )}
          >
            <div
              className="flex items-center justify-center"
              style={{ height: `${rowH}px`, fontSize: cellFont }}
            >
              {v.t || "—"}
            </div>
          </td>
        ))}
        <td
          rowSpan={2}
          className={cn("p-0 border-l-2 border-border text-center font-extrabold tabular-nums")}
          style={{ fontSize: numFont }}
        >
          {fmtNum(totalC)}
        </td>
        <td
          rowSpan={2}
          className={cn(
            "p-0 border-l-2 border-border text-center font-extrabold tabular-nums",
            achievement >= 100
              ? "text-success"
              : achievement >= 70
                ? "text-warning"
                : "text-destructive",
          )}
          style={{ fontSize: numFont }}
        >
          {achievement.toFixed(1)}%
        </td>
        <td
          rowSpan={2}
          className={cn(
            "p-0 border-l-2 border-border text-center font-extrabold uppercase tracking-wider leading-tight",
            statusBadge(status),
          )}
          style={{ fontSize: rowH <= 16 ? "7px" : rowH >= 30 ? "10px" : "8px" }}
        >
          {status}
        </td>
      </tr>
      <tr
        className="border-b-2 border-border hover:bg-primary/5 transition-colors"
        style={{ height: `${rowH}px` }}
      >
        <td
          className={cn(
            "p-0 border-r-2 border-border text-center text-muted-foreground font-bold uppercase tracking-wider bg-muted/20",
          )}
          style={{ fontSize: labelFont }}
        >
          <div className="flex items-center justify-center" style={{ height: `${rowH}px` }}>
            Output
          </div>
        </td>
        {cells.map((v, i) => (
          <td key={i} className={cn("p-0 text-center overflow-hidden border-0", cellTone(v))}>
            <div
              className="flex items-center justify-center"
              style={{ height: `${rowH}px`, fontSize: cellFont }}
            >
              {v.c || (v.t ? 0 : "—")}
            </div>
          </td>
        ))}
      </tr>
    </>
  );
};

type StockRow = {
  type: "Product" | "Accessory";
  name: string;
  plan: number;
  actual: number;
  stock: number;
  id: string;
};

const StockOverview = ({
  inventory,
  accessories,
  accessoryInv,
  products,
}: {
  inventory: { product_id: string | null; product_name: string | null; plan_qty: number; actual_complete_qty: number; quantity: number }[];
  accessories: { id: string; name: string }[];
  accessoryInv: { accessory_id: string; plan_qty: number; actual_complete_qty: number; stock_qty: number }[];
  products: { id: string; name: string }[];
}) => {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const rows = useMemo<StockRow[]>(() => {
    const prodRows: StockRow[] = inventory
      .filter((i) => i.plan_qty > 0 || i.actual_complete_qty > 0 || (i.quantity > 0))
      .map((i) => ({
        type: "Product" as const,
        name: i.product_name ?? "—",
        plan: i.plan_qty,
        actual: i.actual_complete_qty,
        stock: i.quantity,
        id: i.product_id ?? "",
      }));
    const accRows: StockRow[] = accessoryInv
      .filter((a) => a.plan_qty > 0 || a.actual_complete_qty > 0 || a.stock_qty > 0)
      .map((a) => {
        const acc = accessories.find((x) => x.id === a.accessory_id);
        return {
          type: "Accessory" as const,
          name: acc?.name ?? "—",
          plan: a.plan_qty,
          actual: a.actual_complete_qty,
          stock: a.stock_qty,
          id: a.accessory_id,
        };
      });
    return [...prodRows, ...accRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, accessories, accessoryInv]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = page >= totalPages ? 0 : page;
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => setPage((p) => (p + 1) % totalPages), 8000);
    return () => clearInterval(id);
  }, [totalPages]);

  const stockClass = (plan: number, stock: number) => {
    if (plan <= 0) return "";
    const ratio = stock / plan;
    if (ratio >= 1) return "text-success";
    if (ratio >= 0.5) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-5xl font-display font-extrabold uppercase tracking-wide text-gradient">
          Daily Stock Overview
        </h2>
        <p className="text-sm md:text-base text-foreground/70 mt-2 uppercase tracking-widest">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-2xl text-foreground/70 uppercase tracking-widest">No stock records</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pageRows.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              className="glass rounded-2xl p-6 border-2 border-border shadow-glow-primary"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {r.type}
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold truncate mb-4">{r.name}</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Plan
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tabular-nums">{fmtNum(r.plan)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Actual
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tabular-nums">{fmtNum(r.actual)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Stock
                  </div>
                  <div
                    className={cn(
                      "text-2xl md:text-3xl font-bold tabular-nums",
                      stockClass(r.plan, r.stock),
                    )}
                  >
                    {fmtNum(r.stock)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "inline-block rounded-full transition-all",
                i === safePage ? "h-2.5 w-6 bg-primary" : "h-2.5 w-2.5 bg-muted",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MonthlyStockOverview = ({
  stockEntries,
  inventory,
  accessoryInv,
  products,
  accessories,
  inventoryLogs,
  days,
  year,
  month,
  monthLabel,
  dayKey,
  today,
  displayMode,
  onPageCount,
}: {
  stockEntries: { product_id: string | null; accessory_id: string | null; entry_date: string; plan_qty: number; actual_complete_qty: number; stock_qty: number; category: string }[];
  inventory: { product_id: string | null; product_name: string | null; plan_qty: number; actual_complete_qty: number; quantity: number }[];
  accessoryInv: { accessory_id: string; plan_qty: number; actual_complete_qty: number; stock_qty: number }[];
  products: { id: string; name: string }[];
  accessories: { id: string; name: string }[];
  inventoryLogs: InventoryLogEntry[];
  days: number[];
  year: number;
  month: number;
  monthLabel: string;
  dayKey: (d: number) => string;
  today: number;
  displayMode: "single" | "four";
  onPageCount?: (count: number) => void;
}) => {
  const dowShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Compute per-day stock from inventory_logs for each product
  const stockFromLogs = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // product_id -> { dateKey -> stock }
    const byProduct = new Map<string, InventoryLogEntry[]>();
    for (const log of inventoryLogs) {
      if (!log.product_id) continue;
      const arr = byProduct.get(log.product_id) ?? [];
      arr.push(log);
      byProduct.set(log.product_id, arr);
    }
    for (const [productId, logs] of byProduct) {
      logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const daily = new Map<string, number>();
      let lastStock: number | null = null;
      for (const log of logs) {
        const date = log.created_at.slice(0, 10);
        daily.set(date, log.new_stock);
        lastStock = log.new_stock;
      }
      // Carry forward for days without a log
      for (const d of days) {
        const key = dayKey(d);
        if (!daily.has(key)) {
          daily.set(key, lastStock ?? 0);
        } else {
          lastStock = daily.get(key)!;
        }
      }
      map.set(productId, daily);
    }
    return map;
  }, [inventoryLogs, days, dayKey]);

  const rows = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();

    const result: Array<{
      id: string; name: string;
      cells: ({ plan: number; actual: number; stock: number } | null)[];
      totalPlan: number; totalActual: number; totalStock: number;
    }> = [];

    inventory.forEach((inv) => {
      if (!inv.product_id) return;
      const id = inv.product_id;
      const name = inv.product_name ?? id;
      if (seen.has(id)) return;
      seen.set(id, { id, name });

      const hasStockEntries = stockEntries.some(
        (s) => s.category === "product" && s.product_id === id
      );
      const productStockFromLogs = stockFromLogs.get(id);

      const cells = days.map((d) => {
        const key = dayKey(d);
        const v = stockEntries.find(
          (s) => s.category === "product" && s.product_id === id && s.entry_date === key
        );
        if (v) return { plan: v.plan_qty, actual: v.actual_complete_qty, stock: v.stock_qty };
        if (productStockFromLogs?.has(key)) {
          return { plan: 0, actual: 0, stock: productStockFromLogs.get(key)! };
        }
        return null;
      });
      const hasAny = cells.some((c) => c !== null);

      if (hasAny) {
        result.push({
          id, name, cells,
          totalPlan: hasStockEntries ? cells.reduce((s, c) => s + (c?.plan ?? 0), 0) : inv.plan_qty,
          totalActual: hasStockEntries ? cells.reduce((s, c) => s + (c?.actual ?? 0), 0) : inv.actual_complete_qty,
          totalStock: inv.quantity,
        });
      } else if (inv.plan_qty > 0 || inv.actual_complete_qty > 0 || inv.quantity > 0) {
        result.push({
          id, name, cells: days.map(() => null),
          totalPlan: inv.plan_qty, totalActual: inv.actual_complete_qty, totalStock: inv.quantity,
        });
      }
    });

    accessoryInv.forEach((accInv) => {
      const id = accInv.accessory_id;
      if (seen.has(id)) return;
      const acc = accessories.find((x) => x.id === id);
      const name = acc?.name ?? id;
      seen.set(id, { id, name });

      const hasStockEntries = stockEntries.some(
        (s) => s.category === "accessory" && s.accessory_id === id
      );

      const cells = days.map((d) => {
        const key = dayKey(d);
        const v = stockEntries.find(
          (s) => s.category === "accessory" && s.accessory_id === id && s.entry_date === key
        );
        if (v) return { plan: v.plan_qty, actual: v.actual_complete_qty, stock: v.stock_qty };
        return null;
      });
      const hasAny = cells.some((c) => c !== null);

      if (hasAny) {
        result.push({
          id, name, cells,
          totalPlan: hasStockEntries ? cells.reduce((s, c) => s + (c?.plan ?? 0), 0) : accInv.plan_qty,
          totalActual: hasStockEntries ? cells.reduce((s, c) => s + (c?.actual ?? 0), 0) : accInv.actual_complete_qty,
          totalStock: accInv.stock_qty,
        });
      } else if (accInv.plan_qty > 0 || accInv.actual_complete_qty > 0 || accInv.stock_qty > 0) {
        result.push({
          id, name, cells: days.map(() => null),
          totalPlan: accInv.plan_qty, totalActual: accInv.actual_complete_qty, totalStock: accInv.stock_qty,
        });
      }
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, accessoryInv, stockEntries, products, accessories, days, dayKey, stockFromLogs]);

  // Pagination
  const PAGE_SIZE = displayMode === "four" ? 2 : rows.length;
  const totalPages = displayMode === "single" ? 1 : Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => { onPageCount?.(totalPages); }, [totalPages, onPageCount]);
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => setPageIndex((p) => (p + 1) % totalPages), 8000);
    return () => clearInterval(id);
  }, [totalPages]);
  useEffect(() => { if (pageIndex >= totalPages) setPageIndex(0); }, [pageIndex, totalPages]);
  const safePage = pageIndex >= totalPages ? 0 : pageIndex;
  const currentPage = rows.length === 0 ? [] : rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const dateLabel = (d: number) => {
    const dow = new Date(year, month, d).getDay();
    return { d: String(d).padStart(2, "0"), dow: dowShort[dow] };
  };

  const cellTone = (v: { plan: number; actual: number; stock: number }, metric: "plan" | "actual" | "stock") => {
    const val = v[metric];
    if (metric === "stock" && v.plan > 0) {
      const ratio = val / v.plan;
      if (ratio >= 1) return "bg-success/30 text-success-foreground font-extrabold";
      if (ratio >= 0.5) return "bg-warning/30 text-warning-foreground font-extrabold";
      return "bg-destructive/30 text-destructive-foreground font-extrabold";
    }
    if (val > 0) return "bg-muted/20 text-foreground";
    return "bg-muted/10 text-muted-foreground/60";
  };

  const isFour = displayMode === "four";
  const rowH = isFour ? 28 : 16;

  // Dynamic row height for single mode
  const [dynRowH, setDynRowH] = useState(rowH);
  useLayoutEffect(() => {
    if (!isFour) {
      const overhead = 220;
      const h = Math.max(10, Math.min(24, (window.innerHeight - overhead) / (rows.length * 3)));
      setDynRowH(Math.round(h));
    } else { setDynRowH(rowH); }
  }, [isFour, rowH, rows.length]);

  if (rows.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-2xl text-foreground/70 uppercase tracking-widest">No stock records</p>
      </div>
    );
  }

  const cellFont = dynRowH <= 16 ? "7px" : dynRowH >= 28 ? "9px" : "8px";
  const labelFont = dynRowH <= 16 ? "6px" : dynRowH >= 28 ? "8px" : "7px";
  const nameFont = dynRowH <= 16 ? "8px" : dynRowH >= 28 ? "11px" : "9px";
  const metrics = ["plan", "actual"] as const;
  const metricLabels = { plan: "Plan", actual: "Actual" };

  return (
    <div className={cn("animate-fade-in", isFour ? "flex flex-col justify-center h-full space-y-2" : "space-y-4")}>
      <div className="text-center">
        <h2 className={cn("font-display font-extrabold tracking-wide uppercase text-gradient", isFour ? "text-2xl md:text-3xl" : "text-xl md:text-2xl")}>
          Monthly Stock Overview
        </h2>
        <p className={cn("text-foreground/70 mt-1 uppercase tracking-[0.25em]", isFour ? "text-xs" : "text-[10px]")}>
          {monthLabel}
        </p>
      </div>

      <div className="glass rounded-2xl overflow-hidden border-2 border-border shadow-glow-primary">
        <div className="w-full" style={displayMode === "single" ? { containerType: "inline-size" } : undefined}>
          <table className={cn("w-full border-collapse tabular-nums", isFour ? "text-[9px]" : "text-[7px]")}>
            <colgroup>
              <col style={{ width: "3%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "5%" }} />
              {days.map((d) => <col key={d} style={{ width: `${55 / days.length}%` }} />)}
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr className="bg-primary/15 border-b-2 border-primary/40">
                <th rowSpan={2} className={cn("bg-card border-r-2 border-border text-center font-bold uppercase px-1 leading-tight", isFour ? "py-1 text-[10px]" : "py-1 text-[7px]")}>S.No</th>
                <th rowSpan={2} className={cn("bg-card border-r-2 border-border text-center font-bold uppercase px-1 leading-tight", isFour ? "py-1 text-[10px]" : "py-1 text-[7px]")}>Name</th>
                <th rowSpan={2} className={cn("border-r-2 border-border text-center font-bold uppercase px-1 leading-tight", isFour ? "py-1 text-[10px]" : "py-1 text-[7px]")}>Metric</th>
                <th colSpan={days.length} className={cn("border-b-2 border-primary/40 text-center font-bold uppercase tracking-[0.2em] text-primary", isFour ? "px-2 py-0.5 text-[9px]" : "px-2 py-0.5 text-[7px]")}>{monthLabel}</th>
                <th rowSpan={2} className={cn("border-l-2 border-border text-center font-bold uppercase px-1 leading-tight", isFour ? "py-1 text-[10px]" : "py-1 text-[7px]")}>Plan Total</th>
                <th rowSpan={2} className={cn("border-l-2 border-border text-center font-bold uppercase px-1 leading-tight", isFour ? "py-1 text-[10px]" : "py-1 text-[7px]")}>Actual Total</th>
                <th rowSpan={2} className={cn("border-l-2 border-border text-center font-bold uppercase px-1 leading-tight", isFour ? "py-1 text-[10px]" : "py-1 text-[7px]")}>Stock</th>
              </tr>
              <tr className="bg-card/80 border-b-2 border-border">
                {days.map((d) => {
                  const lbl = dateLabel(d);
                  const isT = d === today;
                  const dow = new Date(year, month, d).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th key={d} className={cn("p-0 border-r border-border/40 text-center font-bold overflow-hidden", isWeekend && "bg-muted/30 text-muted-foreground", isT && "bg-primary text-primary-foreground")}>
                      <div className="flex flex-col items-center justify-center" style={{ height: isFour ? "32px" : "auto", aspectRatio: isFour ? undefined : "1" }}>
                        <div className={cn("leading-none", isFour && "text-[9px]")}>{lbl.d}</div>
                        <div className={cn("font-medium leading-tight mt-0.5 uppercase", isFour ? "text-[8px]" : "text-[7px] md:text-[8px]", isT ? "text-primary-foreground/90" : "text-muted-foreground")}>{lbl.dow}</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {currentPage.map((r, idx) => (
                <StockFragmentRow
                  key={r.id}
                  idx={safePage * PAGE_SIZE + idx + 1}
                  name={r.name}
                  cells={r.cells}
                  totalPlan={r.totalPlan}
                  totalActual={r.totalActual}
                  totalStock={r.totalStock}
                  cellTone={cellTone}
                  today={today}
                  days={days}
                  rowH={dynRowH}
                  cellFont={cellFont}
                  labelFont={labelFont}
                  nameFont={nameFont}
                  metrics={metrics}
                  metricLabels={metricLabels}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isFour && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <span key={i} className={cn("inline-block rounded-full transition-all", i === safePage ? "bg-primary h-2 w-4" : "bg-muted h-2 w-2")} />
          ))}
        </div>
      )}
    </div>
  );
};

const StockFragmentRow = ({
  idx, name, cells, totalPlan, totalActual, totalStock, cellTone, today, days, rowH, cellFont, labelFont, nameFont, metrics, metricLabels,
}: {
  idx: number; name: string;
  cells: ({ plan: number; actual: number; stock: number } | null)[];
  totalPlan: number; totalActual: number; totalStock: number;
  cellTone: (v: { plan: number; actual: number; stock: number }, metric: "plan" | "actual") => string;
  today: number; days: number[];
  rowH: number; cellFont: string; labelFont: string; nameFont: string;
  metrics: readonly ("plan" | "actual")[];
  metricLabels: Record<string, string>;
}) => {
  const numFont = rowH <= 16 ? "8px" : rowH >= 28 ? "11px" : "9px";

  return (
    <>
      {metrics.map((metric, mi) => (
        <tr key={metric} className={cn("border-t border-border/50 hover:bg-primary/5 transition-colors", mi === 0 && "border-t-2 border-border")} style={{ height: `${rowH}px` }}>
          {mi === 0 && (
            <>
              <td rowSpan={2} className="bg-card p-0 border-r-2 border-border text-center font-bold text-primary" style={{ fontSize: nameFont }}>{idx}</td>
              <td rowSpan={2} className="bg-card p-0 border-r-2 border-border text-center font-bold truncate">
                <div className="px-0.5 truncate" style={{ fontSize: nameFont }}>{name}</div>
              </td>
            </>
          )}
          <td className={cn("p-0 border-r-2 border-border text-center text-muted-foreground font-bold uppercase tracking-wider bg-muted/20")} style={{ fontSize: labelFont }}>
            <div className="flex items-center justify-center" style={{ height: `${rowH}px` }}>{metricLabels[metric]}</div>
          </td>
          {cells.map((v, i) => {
            if (v === null) {
              return (
                <td key={i} className="p-0 text-center overflow-hidden border-0 text-muted-foreground/40">
                  <div className="flex items-center justify-center" style={{ height: `${rowH}px`, fontSize: cellFont }}>—</div>
                </td>
              );
            }
            return (
              <td key={i} className={cn("p-0 text-center overflow-hidden border-0", cellTone(v, metric))}>
                <div className="flex items-center justify-center" style={{ height: `${rowH}px`, fontSize: cellFont }}>
                  {v[metric] || "—"}
                </div>
              </td>
            );
          })}
          {mi === 0 && (
            <>
              <td rowSpan={2} className="p-0 border-l-2 border-border text-center font-extrabold tabular-nums" style={{ fontSize: numFont }}>{fmtNum(totalPlan)}</td>
              <td rowSpan={2} className="p-0 border-l-2 border-border text-center font-extrabold tabular-nums" style={{ fontSize: numFont }}>{fmtNum(totalActual)}</td>
              <td rowSpan={2} className="p-0 border-l-2 border-border text-center font-extrabold tabular-nums" style={{ fontSize: numFont }}>{fmtNum(totalStock)}</td>
            </>
          )}
        </tr>
      ))}
    </>
  );
};
