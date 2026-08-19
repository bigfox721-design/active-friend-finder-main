import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageTitle";
import { useActivityLogs } from "@/hooks/useActivityLog";
import { History } from "lucide-react";
import { fmtDate } from "@/lib/format";

const actionIcons: Record<string, string> = {
  entry_created: "📝",
  entry_updated: "✏️",
  target_set: "🎯",
  delay_reason: "⚠️",
  inventory_adjust: "📦",
  transfer_init: "🚚",
  transfer_complete: "✅",
  override_granted: "🔑",
  user_login: "🔓",
  user_logout: "🔒",
};

export default function ActivityStatus() {
  const { data: logs = [], isLoading } = useActivityLogs(200);

  const filteredLogs = useMemo(() => logs.filter((log) => log.user_role === "user"), [logs]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredLogs>();
    filteredLogs.forEach((log) => {
      const date = log.created_at?.slice(0, 10) ?? "unknown";
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(log);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <PageTitle>Activity <span className="text-gradient">Status</span></PageTitle>
          <p className="text-sm text-muted-foreground">
            Track all actions performed across the system
          </p>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading activity log...</p>}

      <div className="space-y-6">
        {grouped.map(([date, entries]) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {fmtDate(date)}
            </h3>
            <div className="space-y-1">
              {entries.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/40 text-sm"
                >
                  <span className="text-lg mt-0.5">{actionIcons[log.action] ?? "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by <span className="font-medium">{log.user_name ?? "Unknown"}</span>
                      {" · "}
                      {new Date(log.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!isLoading && grouped.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No activity recorded yet.</p>
        )}
      </div>
    </AppShell>
  );
}
