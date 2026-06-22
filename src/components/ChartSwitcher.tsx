import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { PieChart as PieIcon, BarChart3, LineChart as LineIcon, Users } from "lucide-react";
import type { EntryWithProduct } from "@/lib/types";
import { fmtDate, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

type ChartKind = "pie" | "bar" | "line" | "manpower";

const COLORS = [
  "hsl(48 96% 53%)",
  "hsl(25 95% 53%)",
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(280 90% 65%)",
  "hsl(0 84% 60%)",
  "hsl(190 90% 50%)",
  "hsl(330 81% 60%)",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  padding: "8px 12px",
};

const safeNum = (n: unknown) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
};

const pctOf = (v: number, total: number) =>
  total > 0 ? Math.round((v / total) * 1000) / 10 : 0;

export const ChartSwitcher = ({
  entries,
  defaultKind = "bar",
  title,
}: {
  entries: EntryWithProduct[];
  defaultKind?: ChartKind;
  title?: string;
}) => {
  const [kind, setKind] = useState<ChartKind>(defaultKind);

  const byDate = useMemo(() => {
    const m = new Map<string, { date: string; target: number; completed: number; manpower: number }>();
    [...entries].reverse().forEach((e) => {
      const cur = m.get(e.entry_date) || { date: e.entry_date, target: 0, completed: 0, manpower: 0 };
      cur.target += safeNum(e.target_qty);
      cur.completed += safeNum(e.completed_qty);
      cur.manpower += safeNum(e.manpower);
      m.set(e.entry_date, cur);
    });
    return Array.from(m.values()).map((d) => ({ ...d, label: fmtDate(d.date) }));
  }, [entries]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { name: string; target: number; completed: number }>();
    entries.forEach((e) => {
      const key = e.product?.name ?? "—";
      const cur = m.get(key) || { name: key, target: 0, completed: 0 };
      cur.target += safeNum(e.target_qty);
      cur.completed += safeNum(e.completed_qty);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.completed - a.completed);
  }, [entries]);

  const completedTotal = useMemo(
    () => byProduct.reduce((s, p) => s + p.completed, 0),
    [byProduct],
  );

  const pieData = useMemo(
    () =>
      byProduct
        .filter((p) => p.completed > 0)
        .map((p) => ({
          name: p.name,
          value: p.completed,
          percentage: pctOf(p.completed, completedTotal),
        })),
    [byProduct, completedTotal],
  );

  const barData = useMemo(
    () =>
      byDate.length > 1
        ? byDate
        : byProduct.map((p) => ({ label: p.name, target: p.target, completed: p.completed })),
    [byDate, byProduct],
  );

  const hasData = entries.length > 0 && (completedTotal > 0 || byProduct.some((p) => p.target > 0));

  const PieTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div style={tooltipStyle}>
        <div className="font-semibold">{p.name}</div>
        <div>{fmtNum(p.value)} ({p.percentage}%)</div>
      </div>
    );
  };

  const GenericTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipStyle}>
        <div className="font-semibold mb-1">{label}</div>
        {payload.map((row: any) => (
          <div key={row.dataKey} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.color }} />
            <span>{row.name}: <strong>{fmtNum(safeNum(row.value))}</strong></span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="font-display text-lg font-semibold">{title ?? "Production overview"}</h3>
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 flex-wrap">
          <Btn active={kind === "pie"} onClick={() => setKind("pie")}><PieIcon className="h-4 w-4" /> Pie</Btn>
          <Btn active={kind === "bar"} onClick={() => setKind("bar")}><BarChart3 className="h-4 w-4" /> Bar</Btn>
          <Btn active={kind === "line"} onClick={() => setKind("line")}><LineIcon className="h-4 w-4" /> Line</Btn>
          <Btn active={kind === "manpower"} onClick={() => setKind("manpower")}><Users className="h-4 w-4" /> Manpower</Btn>
        </div>
      </div>

      <div className="h-72 w-full">
        {!hasData ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
            No production data for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer key={`${kind}-${entries.length}-${completedTotal}`}>
            {kind === "pie" ? (
              pieData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                  No completed production yet.
                </div>
              ) : (
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={pieData.length > 1 ? 3 : 0}
                    isAnimationActive={false}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string, _e: any, i: number) => {
                      const d = pieData[i];
                      return d ? `${value}: ${fmtNum(d.value)} (${d.percentage}%)` : value;
                    }}
                  />
                </PieChart>
              )
            ) : kind === "bar" ? (
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip content={<GenericTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="target" name="Target" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            ) : kind === "line" ? (
              <LineChart data={byDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip content={<GenericTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="target" name="Target" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            ) : (
              <ComposedChart data={byDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip content={<GenericTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="completed" name="Production" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="manpower" name="Manpower" stroke="hsl(25 95% 53%)" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

const Btn = ({ active, children, onClick }: any) => (
  <button onClick={onClick} className={cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-smooth",
    active ? "bg-primary text-primary-foreground shadow-glow-primary" : "text-muted-foreground hover:text-foreground"
  )}>{children}</button>
);
