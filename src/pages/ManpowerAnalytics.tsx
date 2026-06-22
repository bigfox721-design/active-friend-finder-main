import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEntries } from "@/hooks/useProduction";
import { todayISO, fmtNum } from "@/lib/format";
import { Loader2, Users, Target, Gauge } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const GREEN = "hsl(142 71% 45%)";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

export default function ManpowerAnalytics() {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const fromISO = fromDate.toISOString().slice(0, 10);
  const { data: entries = [], isLoading } = useEntries({ from: fromISO, to: todayISO() });

  const { trend, totalManpower, requiredManpower, efficiency, totalTarget, totalCompleted } = useMemo(() => {
    const byDate = new Map<string, { manpower: number; target: number; completed: number }>();
    entries.forEach((e) => {
      const d = e.entry_date;
      const cur = byDate.get(d) ?? { manpower: 0, target: 0, completed: 0 };
      cur.manpower += e.manpower ?? 0;
      cur.target += e.target_qty ?? 0;
      cur.completed += e.completed_qty ?? 0;
      byDate.set(d, cur);
    });
    const trend = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        manpower: v.manpower,
      }));
    const totalManpower = entries.reduce((s, e) => s + (e.manpower ?? 0), 0);
    const totalTarget = entries.reduce((s, e) => s + (e.target_qty ?? 0), 0);
    const totalCompleted = entries.reduce((s, e) => s + (e.completed_qty ?? 0), 0);
    const perWorker = totalManpower > 0 ? totalCompleted / totalManpower : 0;
    const requiredManpower = perWorker > 0 ? Math.ceil(totalTarget / perWorker) : 0;
    const efficiency = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
    return { trend, totalManpower, requiredManpower, efficiency, totalTarget, totalCompleted };
  }, [entries]);

  const manpowerProgress = requiredManpower > 0
    ? Math.min(100, Math.round((totalManpower / requiredManpower) * 100))
    : 0;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Manpower <span className="text-gradient">Analytics</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Workforce trends and efficiency over the last 30 days
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Total Manpower" value={fmtNum(totalManpower)} icon={Users} accent="text-primary" />
            <KpiCard label="Required Manpower" value={fmtNum(requiredManpower)} icon={Target} accent="text-amber-500" />
            <KpiCard
              label="Efficiency"
              value={`${efficiency}%`}
              icon={Gauge}
              accent={efficiency >= 100 ? "text-green-500" : efficiency >= 85 ? "text-amber-500" : "text-red-500"}
            />
          </div>

          <Card className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-base font-semibold">Manpower vs Required</h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtNum(totalManpower)} / {fmtNum(requiredManpower)}
              </span>
            </div>
            <Progress value={manpowerProgress} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              Completed {fmtNum(totalCompleted)} of {fmtNum(totalTarget)} units
            </p>
          </Card>

          <Card className="glass rounded-2xl p-5">
            <h3 className="font-display text-lg font-semibold mb-4">Manpower Trend (Last 30 Days)</h3>
            <div className="h-80 w-full">
              {trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No manpower data available
                </div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="manpower"
                      name="Manpower"
                      stroke={GREEN}
                      strokeWidth={3}
                      dot={{ r: 4, fill: GREEN }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

const KpiCard = ({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: any; accent: string;
}) => (
  <Card className="glass rounded-2xl p-5">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <Icon className={`h-5 w-5 ${accent}`} />
    </div>
    <p className={`font-display text-3xl font-bold tabular-nums ${accent}`}>{value}</p>
  </Card>
);
