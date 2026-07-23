import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ChartSwitcher } from "@/components/ChartSwitcher";
import { ExportButtons } from "@/components/ExportButtons";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { useEntries, useProducts } from "@/hooks/useProduction";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum, todayISO } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Range = "daily" | "weekly" | "monthly";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// Returns weeks of a month, each week is array of {day, date} for Mon..Sun.
// Week 1 starts on the 1st, days before Monday in that ISO-style week are still part of week 1's row but only show in-month dates.
function weeksOfMonth(y: number, m: number) {
  const total = daysInMonth(y, m);
  const weeks: { label: string; days: { day: number; date: string; weekday: string }[] }[] = [];
  const wdNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let current: { day: number; date: string; weekday: string }[] = [];
  let weekIdx = 1;

  for (let d = 1; d <= total; d++) {
    const dt = new Date(y, m, d);
    // JS: 0=Sun..6=Sat. Convert to Mon=0..Sun=6
    const idx = (dt.getDay() + 6) % 7;
    if (d === 1 && idx !== 0) {
      // pad start with placeholders so Monday aligns
      for (let i = 0; i < idx; i++) current.push({ day: 0, date: "", weekday: wdNames[i] });
    }
    current.push({ day: d, date: iso(y, m, d), weekday: wdNames[idx] });
    if (idx === 6 || d === total) {
      // pad end if last week
      while (current.length < 7) {
        current.push({ day: 0, date: "", weekday: wdNames[current.length] });
      }
      weeks.push({ label: `Week ${weekIdx}`, days: current });
      weekIdx++;
      current = [];
    }
  }
  return weeks;
}

export default function History() {
  const [range, setRange] = useState<Range>("daily");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filterProductId, setFilterProductId] = useState("");
  const [filterSubProductId, setFilterSubProductId] = useState("");

  const { data: products = [] } = useProducts();
  const { data: subProducts = [] } = useQuery({
    queryKey: ["sub_products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; product_id: string; name: string }[];
    },
  });

  const filteredSubProducts = useMemo(
    () => (filterProductId ? subProducts.filter((s) => s.product_id === filterProductId) : subProducts),
    [subProducts, filterProductId],
  );

  // Fetch range based on selection
  const { from, to } = useMemo(() => {
    if (range === "monthly") {
      return { from: iso(year, 0, 1), to: iso(year, 11, 31) };
    }
    const last = daysInMonth(year, month);
    return { from: iso(year, month, 1), to: iso(year, month, last) };
  }, [range, year, month]);

  const { data: rawEntries = [], isLoading } = useEntries({ from, to });

  // Filter entries by product / sub-product
  const entries = useMemo(() => {
    let filtered = rawEntries;
    if (filterSubProductId) {
      filtered = filtered.filter((e) => e.product_id === filterSubProductId);
    } else if (filterProductId) {
      const subIds = new Set(
        subProducts.filter((s) => s.product_id === filterProductId).map((s) => s.id),
      );
      filtered = filtered.filter((e) => e.product_id === filterProductId || subIds.has(e.product_id));
    }
    return filtered;
  }, [rawEntries, filterProductId, filterSubProductId, subProducts]);

  const byDate = useMemo(() => {
    const map = new Map<string, { target: number; completed: number }>();
    for (const e of entries) {
      const cur = map.get(e.entry_date) ?? { target: 0, completed: 0 };
      cur.target += e.target_qty;
      cur.completed += e.completed_qty;
      map.set(e.entry_date, cur);
    }
    return map;
  }, [entries]);

  // Aggregate by month index for monthly view
  const byMonth = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => ({ target: 0, completed: 0 }));
    for (const e of entries) {
      const dt = new Date(e.entry_date);
      if (dt.getFullYear() === year) {
        arr[dt.getMonth()].target += e.target_qty;
        arr[dt.getMonth()].completed += e.completed_qty;
      }
    }
    return arr;
  }, [entries, year]);

  const totalDays = daysInMonth(year, month);
  const weeks = useMemo(() => weeksOfMonth(year, month), [year, month]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Production <span className="text-gradient">History</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Filter, analyze, and export past performance.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg bg-secondary/60">
            {(["daily", "weekly", "monthly"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-smooth",
                  range === r
                    ? "bg-primary text-primary-foreground shadow-glow-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {range !== "monthly" && (
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 px-2 rounded-md bg-secondary/60 border border-border text-xs"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 px-2 rounded-md bg-secondary/60 border border-border text-xs"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={filterProductId}
            onChange={(e) => { setFilterProductId(e.target.value); setFilterSubProductId(""); }}
            className="h-9 px-2 rounded-md bg-secondary/60 border border-border text-xs w-32"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {filteredSubProducts.length > 0 && (
            <select
              value={filterSubProductId}
              onChange={(e) => setFilterSubProductId(e.target.value)}
              className="h-9 px-2 rounded-md bg-secondary/60 border border-border text-xs w-32"
            >
              <option value="">All sub</option>
              {filteredSubProducts.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          )}
          <ExportButtons entries={entries} />
        </div>
      </div>

      <div className="mb-6">
        {range === "daily" ? (
          <ChartSwitcher entries={entries} title={`Daily comparison`} />
        ) : (
          <Card className="glass rounded-2xl p-5">
            <h3 className="font-display text-lg font-semibold mb-4">
              {range === "weekly"
                ? `Weekly comparison · ${MONTHS[month]} ${year}`
                : `Monthly comparison · ${year}`}
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={
                    range === "weekly"
                      ? weeks.map((w) => {
                          const t = w.days.reduce(
                            (acc, d) => {
                              if (!d.date) return acc;
                              const v = byDate.get(d.date);
                              if (v) {
                                acc.target += v.target;
                                acc.completed += v.completed;
                              }
                              return acc;
                            },
                            { target: 0, completed: 0 },
                          );
                          return { label: w.label, target: t.target, completed: t.completed };
                        })
                      : MONTHS.map((m, i) => ({
                          label: m.slice(0, 3),
                          target: byMonth[i].target,
                          completed: byMonth[i].completed,
                        }))
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="target" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      <Card className="glass rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold">
            {range === "daily" && `Daily · ${MONTHS[month]} ${year}`}
            {range === "weekly" && `Weekly · ${MONTHS[month]} ${year}`}
            {range === "monthly" && `Monthly · ${year}`}
          </h3>
          <span className="text-xs text-muted-foreground">{entries.length} entries</span>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* DAILY: Days 1..N of selected month */}
            {range === "daily" && (
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Target</th>
                    <th className="px-4 py-3 text-right">Completed</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
                    const date = iso(year, month, d);
                    const v = byDate.get(date) ?? { target: 0, completed: 0 };
                    return (
                      <tr key={d} className="border-t border-border hover:bg-secondary/30">
                        <td className="px-4 py-3 tabular-nums font-semibold">{d}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {new Date(year, month, d).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(v.target)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {fmtNum(v.completed)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge completed={v.completed} target={v.target} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* WEEKLY: Week 1..N of month, each week Mon..Sun */}
            {range === "weekly" && (
              <div className="divide-y divide-border">
                {weeks.map((w) => {
                  const weekTotals = w.days.reduce(
                    (acc, d) => {
                      if (!d.date) return acc;
                      const v = byDate.get(d.date);
                      if (v) {
                        acc.target += v.target;
                        acc.completed += v.completed;
                      }
                      return acc;
                    },
                    { target: 0, completed: 0 },
                  );
                  return (
                    <div key={w.label} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-display font-semibold text-sm">{w.label}</h4>
                        <div className="text-xs text-muted-foreground">
                          Target:{" "}
                          <span className="text-foreground font-semibold tabular-nums">
                            {fmtNum(weekTotals.target)}
                          </span>
                          <span className="mx-2">·</span>
                          Completed:{" "}
                          <span className="text-foreground font-semibold tabular-nums">
                            {fmtNum(weekTotals.completed)}
                          </span>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/40">
                          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="px-3 py-2 text-left">Day</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-right">Target</th>
                            <th className="px-3 py-2 text-right">Completed</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {w.days.map((d, i) => {
                            if (!d.date) {
                              return (
                                <tr key={i} className="border-t border-border opacity-40">
                                  <td className="px-3 py-2">{d.weekday}</td>
                                  <td className="px-3 py-2 text-muted-foreground">—</td>
                                  <td className="px-3 py-2 text-right">—</td>
                                  <td className="px-3 py-2 text-right">—</td>
                                  <td className="px-3 py-2 text-muted-foreground">—</td>
                                </tr>
                              );
                            }
                            const v = byDate.get(d.date) ?? {
                              target: 0,
                              completed: 0,
                            };
                            return (
                              <tr key={i} className="border-t border-border hover:bg-secondary/30">
                                <td className="px-3 py-2 font-medium">{d.weekday}</td>
                                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                  {MONTHS[month].slice(0, 3)} {d.day}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmtNum(v.target)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                  {fmtNum(v.completed)}
                                </td>
                                <td className="px-3 py-2">
                                  <StatusBadge completed={v.completed} target={v.target} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MONTHLY: Jan..Dec for selected year */}
            {range === "monthly" && (
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Target</th>
                    <th className="px-4 py-3 text-right">Completed</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((m, i) => {
                    const v = byMonth[i];
                    return (
                      <tr key={m} className="border-t border-border hover:bg-secondary/30">
                        <td className="px-4 py-3 font-medium">{m}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(v.target)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {fmtNum(v.completed)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge completed={v.completed} target={v.target} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
