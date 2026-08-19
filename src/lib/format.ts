export const localISO = (d?: Date) => {
  const date = d ?? new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayISO = () => localISO();

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
  if (completed <= 0 || target <= 0) return "pending" as const;
  if (completed >= target) return "reached" as const;
  if (completed >= target * 0.85) return "warning" as const;
  return "missed" as const;
};
