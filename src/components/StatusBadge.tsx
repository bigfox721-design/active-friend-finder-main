import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { statusOf, pct, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const cfg = {
  reached: { label: "Target Reached", icon: CheckCircle2, classes: "bg-success/15 text-success border-success/30" },
  warning: { label: "Close to Target", icon: AlertTriangle, classes: "bg-warning/15 text-warning border-warning/30" },
  missed: { label: "Target Missed", icon: XCircle, classes: "bg-destructive/15 text-destructive border-destructive/40 animate-glow" },
  pending: { label: "No target set", icon: Clock, classes: "bg-muted/40 text-muted-foreground border-border" },
} as const;

export const StatusBadge = ({ completed, target, big = false }: { completed: number; target: number; big?: boolean }) => {
  const s = statusOf(completed, target);
  const { label, icon: Icon, classes } = cfg[s];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border font-semibold",
      big ? "px-4 py-2 text-base" : "px-2.5 py-1 text-xs",
      classes
    )}>
      <Icon className={big ? "h-5 w-5" : "h-3.5 w-3.5"} />
      {label}
      {target > 0 && <span className="opacity-80 ml-1">· {pct(completed, target)}%</span>}
    </span>
  );
};

export { fmtNum };
