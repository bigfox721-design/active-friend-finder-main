import { Card } from "@/components/ui/card";
import { fmtNum } from "@/lib/format";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const KpiCard = ({ label, value, sub, icon: Icon, tone = "default", big = false }: {
  label: string; value: string | number; sub?: string;
  icon?: LucideIcon; tone?: "default" | "success" | "danger" | "accent" | "warning"; big?: boolean;
}) => {
  const tones = {
    default: "border-border",
    success: "border-success/40 shadow-glow-primary",
    danger: "border-destructive/40 shadow-glow-danger",
    accent: "border-accent/40 shadow-glow-accent",
    warning: "border-warning/40",
  };
  const display = typeof value === "number" ? fmtNum(value) : String(value);
  const len = display.length;
  // Dynamic font scaling based on character length
  const sizeClass = big
    ? len <= 2
      ? "text-6xl md:text-8xl"
      : len <= 4
        ? "text-5xl md:text-7xl"
        : len <= 6
          ? "text-4xl md:text-6xl"
          : len <= 8
            ? "text-3xl md:text-5xl"
            : "text-2xl md:text-4xl"
    : len <= 2
      ? "text-4xl"
      : len <= 4
        ? "text-3xl"
        : len <= 6
          ? "text-2xl"
          : "text-xl";
  return (
    <Card className={cn("glass rounded-2xl p-5 flex flex-col items-center justify-center text-center overflow-hidden", big ? "min-h-[192px]" : "min-h-[132px]", tones[tone])}>
      <div className="flex items-center justify-center gap-2 mb-2 w-full min-h-5">
        <p className={cn("uppercase tracking-wider text-muted-foreground text-center leading-tight", big ? "text-sm" : "text-xs")}>{label}</p>
        {Icon && <Icon className={cn("text-primary", big ? "h-6 w-6" : "h-4 w-4")} />}
      </div>
      <p
        className={cn(
          "font-display font-bold tabular-nums leading-none text-center w-full max-w-full truncate px-1",
          sizeClass,
        )}
        title={display}
      >
        {display}
      </p>
      {sub && <p className={cn("text-muted-foreground mt-1 text-center leading-tight truncate max-w-full px-1", big ? "text-base" : "text-xs")}>{sub}</p>}
    </Card>
  );
};
