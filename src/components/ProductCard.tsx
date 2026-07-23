import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./StatusBadge";
import { fmtNum, pct, statusOf } from "@/lib/format";
import type { Product, ProductionEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const c = entry?.completed_qty ?? 0;
  const mp = entry?.manpower ?? 0;
  const perWorker = mp > 0 ? Math.round((c / mp) * 10) / 10 : 0;
  const status = statusOf(c, t);

  return (
    <Card
      className={cn(
        "glass p-5 rounded-2xl transition-smooth hover:scale-[1.01]",
        status === "missed" && "border-destructive/40",
        status === "reached" && "border-success/30",
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {product.is_sub && <span className="text-xs text-muted-foreground">↳</span>}
            <h3 className="font-display text-xl font-bold tracking-tight">{product.name}</h3>
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

      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="flex flex-col items-center justify-center h-[80px] rounded-xl bg-white text-gray-900 shadow-md dark:bg-gray-900 dark:text-white dark:shadow-none">
          <p className="text-xl font-bold">{fmtNum(t)}</p>
          <p className="text-[10px] mt-1 text-center leading-tight uppercase text-gray-600 dark:text-gray-400">
            TARGET
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-[80px] rounded-xl border-2 border-green-500 bg-white text-gray-900 shadow-md dark:bg-gray-900 dark:text-white dark:shadow-none">
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmtNum(c)}</p>
          <p className="text-[10px] mt-1 text-center leading-tight uppercase text-gray-600 dark:text-gray-400">
            COMPLETED
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-[80px] rounded-xl bg-white text-gray-900 shadow-md dark:bg-gray-900 dark:text-white dark:shadow-none">
          <p className="text-xl font-bold">{fmtNum(mp)}</p>
          <p className="text-[10px] mt-1 text-center leading-tight uppercase text-gray-600 dark:text-gray-400">
            MANPOWER
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-[80px] rounded-xl bg-white text-gray-900 shadow-md dark:bg-gray-900 dark:text-white dark:shadow-none">
          <p className="text-xl font-bold">{mp > 0 ? perWorker.toString() : "—"}</p>
          <p className="text-[10px] mt-1 text-center leading-tight uppercase text-gray-600 dark:text-gray-400">
            PER WORKER
          </p>
        </div>
      </div>

      <Progress value={Math.min(100, pct(c, t))} className="h-2 my-4" />
    </Card>
  );
};
