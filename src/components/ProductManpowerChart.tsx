import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";
import { BarChart3, LineChart as LineIcon } from "lucide-react";
import type { EntryWithProduct } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "bar" | "line";

const GREEN = "hsl(142 71% 45%)";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

export const ProductManpowerChart = ({
  entries,
  title = "Product vs Manpower",
}: {
  entries: EntryWithProduct[];
  title?: string;
}) => {
  const [kind, setKind] = useState<Kind>("bar");

  const data = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => {
      const name = e.product?.name ?? "—";
      m.set(name, (m.get(name) ?? 0) + (e.manpower ?? 0));
    });
    return Array.from(m.entries())
      .map(([product, manpower]) => ({ product, manpower }))
      .filter((d) => d.manpower > 0)
      .sort((a, b) => b.manpower - a.manpower);
  }, [entries]);

  return (
    <Card className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/60">
          <Btn active={kind === "bar"} onClick={() => setKind("bar")}>
            <BarChart3 className="h-4 w-4" /> Bar
          </Btn>
          <Btn active={kind === "line"} onClick={() => setKind("line")}>
            <LineIcon className="h-4 w-4" /> Line
          </Btn>
        </div>
      </div>

      <div className="h-80 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No manpower data available
          </div>
        ) : (
          <ResponsiveContainer>
            {kind === "bar" ? (
              <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="product" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                <Bar dataKey="manpower" name="Manpower" fill={GREEN} radius={[8, 8, 0, 0]}>
                  <LabelList dataKey="manpower" position="top" fill="hsl(var(--foreground))" fontSize={11} />
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="product" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="manpower"
                  name="Manpower"
                  stroke={GREEN}
                  strokeWidth={3}
                  dot={{ r: 5, fill: GREEN }}
                  activeDot={{ r: 7 }}
                >
                  <LabelList dataKey="manpower" position="top" fill="hsl(var(--foreground))" fontSize={11} />
                </Line>
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

const Btn = ({ active, children, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-smooth",
      active ? "bg-primary text-primary-foreground shadow-glow-primary" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {children}
  </button>
);
