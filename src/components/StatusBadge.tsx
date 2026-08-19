import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { statusOf, pct, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const cfg = {
  reached: {
    label: "Target Achieved",
    icon: CheckCircle2,
    classes: "bg-success/10 text-success border-success/25",
  },
  warning: {
    label: "Close to Target",
    icon: AlertTriangle,
    classes: "bg-warning/10 text-warning border-warning/25",
  },
  missed: {
    label: "Target Missed",
    icon: XCircle,
    classes: "bg-destructive/10 text-destructive border-destructive/30",
  },
  pending: {
    label: "In Progress",
    icon: Clock,
    classes: "bg-muted/40 text-muted-foreground border-border",
  },
} as const;

export const StatusBadge = ({
  completed,
  target,
  big = false,
}: {
  completed: number;
  target: number;
  big?: boolean;
}) => {
  const s = statusOf(completed, target);
  const { label, icon: Icon, classes } = cfg[s];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide",
        big ? "px-4 py-2 text-base" : "px-3 py-1 text-[11px] uppercase",
        classes,
      )}
    >
      <Icon className={big ? "h-5 w-5" : "h-3.5 w-3.5"} />
      {label}
      {target > 0 && <span className="opacity-75 ml-1 font-mono text-[10px]">{pct(completed, target)}%</span>}
    </span>
  );
};

export { fmtNum };
