import { useState, useRef, useEffect } from "react";
import { Bell, Reply, Check, Trash2 } from "lucide-react";
import { useNavigate } from "@/lib/router-shim";
import {
  useUnreadCount,
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useClearAllNotifications,
  useDeleteNotification,
} from "@/hooks/useNotifications";
import type { Notification } from "@/hooks/useNotifications";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const NOTIFICATION_LINKS: Record<string, string> = {
  material_transfer: "/material-transfer",
};

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const clearAll = useClearAllNotifications();
  const deleteNotification = useDeleteNotification();

  // Only unread notifications are shown; marking one read makes it disappear.
  const visible = notifications.filter((n) => !n.is_read).slice(0, 20);

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete notification");
    }
  };

  const handleClearAll = async () => {
    setConfirmClear(false);
    try {
      await clearAll.mutateAsync();
      toast.success("All notifications cleared");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to clear notifications");
    }
  };

  const handleReply = (n: Notification) => {
    markRead.mutate(n.id);
    setOpen(false);
    navigate(NOTIFICATION_LINKS[n.type] ?? "/material-transfer");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-smooth"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold">Notifications</span>
            <div className="flex items-center gap-2.5">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-[10px] text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              {visible.length > 0 && (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-[10px] text-destructive hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visible.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No notifications</p>
            ) : (
              visible.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead.mutate(n.id)}
                  className={`w-full text-left px-3 py-2.5 text-xs border-b border-border last:border-0 transition-smooth cursor-pointer ${
                    n.is_read ? "opacity-60" : "bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.message && <div className="text-muted-foreground mt-0.5">{n.message}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleReply(n)}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <Reply className="h-3 w-3" /> Reply
                    </button>
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <Check className="h-3 w-3" /> Mark as read
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="ml-auto inline-flex items-center gap-1 text-[10px] text-destructive hover:underline"
                      title="Delete notification"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground"
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
