export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const fmtNum = (n: number) => new Intl.NumberFormat().format(n);

export const pct = (completed: number, target: number) => {
  if (!target) return 0;
  return Math.round((completed / target) * 100);
};

export const statusOf = (completed: number, target: number) => {
  if (target <= 0) return "pending" as const;
  if (completed >= target) return "reached" as const;
  if (completed >= target * 0.85) return "warning" as const;
  return "missed" as const;
};
