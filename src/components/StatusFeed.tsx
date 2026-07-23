import { useStatusUpdates } from "@/hooks/useStatusUpdates";
import { cn } from "@/lib/utils";

const typeStyles: Record<string, string> = {
  info: "border-l-blue-500 bg-blue-500/5",
  warning: "border-l-yellow-500 bg-yellow-500/5",
  success: "border-l-emerald-500 bg-emerald-500/5",
  error: "border-l-red-500 bg-red-500/5",
  transfer: "border-l-purple-500 bg-purple-500/5",
  process_complete: "border-l-green-500 bg-green-500/5",
};

export function StatusFeed({ className, compact }: { className?: string; compact?: boolean }) {
  const { data: updates = [], isLoading } = useStatusUpdates(compact ? 10 : 50);

  return (
    <div className={cn("space-y-1", className)}>
      {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
      {!isLoading && updates.length === 0 && (
        <p className="text-xs text-muted-foreground">No updates yet.</p>
      )}
      {updates.map((u) => (
        <div
          key={u.id}
          className={cn(
            "border-l-2 pl-3 py-1.5 rounded-r-md",
            typeStyles[u.update_type] ?? typeStyles.info,
          )}
        >
          <p className={cn("text-foreground", compact ? "text-xs" : "text-sm")}>{u.message}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {u.user_name ?? "System"}
            {" · "}
            {new Date(u.created_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
