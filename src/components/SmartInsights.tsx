import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle, Users } from "lucide-react";
import type { EntryWithProduct } from "@/lib/types";
import { todayISO } from "@/lib/format";

export const SmartInsights = ({ entries }: { entries: EntryWithProduct[] }) => {
  const insights = useMemo(() => generateInsights(entries), [entries]);
  if (!insights.length) return null;
  return (
    <Card className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="font-display font-semibold">Smart insights</h3>
      </div>
      <ul className="space-y-2.5">
        {insights.map((i, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2.5 text-sm animate-slide-in"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <i.icon className={`h-4 w-4 mt-0.5 ${i.color}`} />
            <span className="text-foreground/90">{i.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

function generateInsights(entries: EntryWithProduct[]) {
  const out: { text: string; icon: any; color: string }[] = [];
  if (!entries.length) return out;
  const today = todayISO();
  const todays = entries.filter((e) => e.entry_date === today);
  const past = entries.filter((e) => e.entry_date !== today);

  // Today vs 7-day avg
  const last7Dates = Array.from(new Set(past.map((e) => e.entry_date)))
    .sort()
    .slice(-7);
  const last7 = past.filter((e) => last7Dates.includes(e.entry_date));
  const avgPerDay = last7.length
    ? last7.reduce((s, e) => s + e.completed_qty, 0) / Math.max(1, last7Dates.length)
    : 0;
  const todayTotal = todays.reduce((s, e) => s + e.completed_qty, 0);
  if (avgPerDay > 0) {
    const diff = ((todayTotal - avgPerDay) / avgPerDay) * 100;
    if (Math.abs(diff) > 1) {
      out.push({
        text: `Today is ${Math.abs(Math.round(diff))}% ${diff >= 0 ? "above" : "below"} your 7-day average (${Math.round(avgPerDay)} units/day).`,
        icon: diff >= 0 ? TrendingUp : TrendingDown,
        color: diff >= 0 ? "text-success" : "text-destructive",
      });
    }
  }

  // Yesterday compare
  const yest = past.filter((e) => e.entry_date === last7Dates.at(-1));
  const yTotal = yest.reduce((s, e) => s + e.completed_qty, 0);
  if (yTotal > 0 && todayTotal > 0) {
    const d = ((todayTotal - yTotal) / yTotal) * 100;
    out.push({
      text: `Production ${d >= 0 ? "improved" : "dropped"} ${Math.abs(Math.round(d))}% vs yesterday.`,
      icon: d >= 0 ? TrendingUp : TrendingDown,
      color: d >= 0 ? "text-success" : "text-warning",
    });
  }

  // Missed targets today
  const missed = todays.filter((e) => e.target_qty > 0 && e.completed_qty < e.target_qty);
  if (missed.length) {
    out.push({
      text: `${missed.length} product${missed.length > 1 ? "s" : ""} missed today's target: ${missed.map((m) => m.product?.name).join(", ")}.`,
      icon: AlertTriangle,
      color: "text-destructive",
    });
  }

  // No targets warning
  const noTargets = todays.filter((e) => e.target_qty === 0);
  if (noTargets.length || (entries.length && !todays.length)) {
    out.push({
      text: `Morning targets not set for some products. Set them to enable status tracking.`,
      icon: AlertTriangle,
      color: "text-warning",
    });
  }

  // Best performer
  if (todays.length > 1) {
    const best = [...todays]
      .filter((e) => e.target_qty > 0)
      .sort((a, b) => b.completed_qty / b.target_qty - a.completed_qty / a.target_qty)[0];
    if (best) {
      out.push({
        text: `Top performer today: ${best.product?.name} at ${Math.round((best.completed_qty / best.target_qty) * 100)}% of target.`,
        icon: Sparkles,
        color: "text-accent",
      });
    }
  }

  // Manpower productivity alerts (today)
  todays.forEach((e) => {
    const mp = e.manpower ?? 0;
    if (mp <= 0 || e.target_qty <= 0) return;
    const ach = e.completed_qty / e.target_qty;
    const perWorker = e.completed_qty / mp;
    if (ach >= 1 && mp <= 5) {
      out.push({
        text: `${e.product?.name}: target hit with only ${mp} worker${mp > 1 ? "s" : ""} (${perWorker.toFixed(1)} ${e.product?.unit}/worker). Lean win!`,
        icon: Sparkles,
        color: "text-success",
      });
    } else if (ach < 0.7 && mp >= 8) {
      out.push({
        text: `${e.product?.name}: ${mp} workers but only ${Math.round(ach * 100)}% of target — productivity ${perWorker.toFixed(1)}/worker.`,
        icon: AlertTriangle,
        color: "text-destructive",
      });
    }
  });

  // Manpower trend vs 7-day avg
  const todayMp = todays.reduce((s, e) => s + (e.manpower ?? 0), 0);
  const last7Mp = last7.reduce((s, e) => s + (e.manpower ?? 0), 0);
  const avgMp = last7Dates.length ? last7Mp / last7Dates.length : 0;
  if (avgMp > 0 && todayMp > 0) {
    const d = Math.round(((todayMp - avgMp) / avgMp) * 100);
    if (Math.abs(d) >= 10) {
      out.push({
        text: `Manpower today (${todayMp}) is ${Math.abs(d)}% ${d >= 0 ? "above" : "below"} 7-day average (${Math.round(avgMp)}).`,
        icon: Users,
        color: d >= 0 ? "text-warning" : "text-accent",
      });
    }
  }

  return out.slice(0, 8);
}
