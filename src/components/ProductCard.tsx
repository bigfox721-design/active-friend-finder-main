import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./StatusBadge";
import { fmtNum, pct, statusOf } from "@/lib/format";
import type { Product, ProductionEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const StatTile = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success";
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center h-[76px] rounded-xl border",
      tone === "success"
        ? "border-success/25 bg-success/5"
        : "border-border/60 bg-secondary/40",
    )}
  >
    <p
      className={cn(
        "text-xl font-bold tabular-nums",
        tone === "success" ? "text-success" : "text-foreground",
      )}
    >
      {fmtNum(value)}
    </p>
    <p className="text-[10px] mt-1 text-center leading-tight uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  </div>
);

export const ProductCard = ({
  product,
  entry,
  standalone = false,
}: {
  product: Product;
  entry?: ProductionEntry;
  standalone?: boolean;
}) => {
  const t = entry?.target_qty ?? 0;
  const c = Number.isFinite(entry?.completed_qty as number) ? entry!.completed_qty! : 0;
  const mp = entry?.manpower ?? 0;
  const perWorker = mp > 0 ? Math.round((c / mp) * 10) / 10 : 0;
  const status = statusOf(c, t);

  return (
    <Card
      className={cn(
        "glass p-5 rounded-2xl transition-smooth hover:scale-[1.01]",
        status === "missed" && "border-destructive/30",
        status === "reached" && "border-success/25",
      )}
    >
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {product.is_sub && <span className="text-xs text-muted-foreground">↳</span>}
            <h3 className="font-display text-xl font-bold tracking-tight break-words leading-tight">
              {product.name}
            </h3>
            {product.code && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                {product.code}
              </span>
            )}
            {product.is_sub && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider">
                Sub
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
            Today's pulse · {product.unit}
          </p>
        </div>
        <StatusBadge completed={c} target={t} />
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <StatTile label="Target" value={t} />
        <StatTile label="Completed" value={c} tone={c > 0 ? "success" : "default"} />
        <StatTile label="Manpower" value={mp} />
        <StatTile label="Per Worker" value={mp > 0 ? perWorker : 0} />
      </div>

      <Progress value={Math.min(100, pct(c, t))} className="h-2 mt-4" />
    </Card>
  );
};
