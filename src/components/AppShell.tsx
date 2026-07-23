import { ReactNode } from "react";
import { NavLink, useNavigate } from "@/lib/router-shim";
import {
  LayoutDashboard,
  History,
  Tv,
  Settings,
  LogOut,
  User as UserIcon,
  GitBranch,
  Package,
  Layers,
  Target,
  Workflow,
  ShieldCheck,
  Truck,
  Warehouse,
  KeyRound,
  Activity,
  Puzzle,
  ShoppingCart,
  ClipboardCheck,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useRole } from "@/hooks/useRole";

const allLinks = [
  {
    to: "/manager-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
    roles: ["manager"] as const,
  },
  {
    to: "/user-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
    roles: ["user"] as const,
  },
  {
    to: "/daily-overview",
    label: "Daily Overview",
    icon: Layers,
    roles: ["manager", "user"] as const,
  },
  { to: "/monthly-target", label: "Monthly Target", icon: Target, roles: ["manager"] as const },
  { to: "/processes", label: "Processes", icon: Workflow, roles: ["manager"] as const },
  { to: "/inventory", label: "Inventory", icon: Warehouse, roles: ["manager", "user"] as const },
  { to: "/quality-checks", label: "Quality", icon: ClipboardCheck, roles: ["manager", "user"] as const },
  { to: "/sales", label: "Sales", icon: ShoppingCart, roles: ["manager", "user"] as const },
  {
    to: "/material-transfer",
    label: "Material Transfer",
    icon: Truck,
    roles: ["manager", "user"] as const,
  },
  {
    to: "/manager-override",
    label: "Manager Override",
    icon: KeyRound,
    roles: ["manager"] as const,
  },
  { to: "/history", label: "History", icon: History, roles: ["manager"] as const },
  { to: "/branches", label: "Branches", icon: GitBranch, roles: ["manager"] as const },
  { to: "/products", label: "Products", icon: Package, roles: ["manager"] as const },
  { to: "/raw-materials", label: "Raw Materials", icon: Package, roles: ["manager"] as const },
  { to: "/accessories", label: "Accessories", icon: Puzzle, roles: ["manager"] as const },
  { to: "/tv", label: "TV Mode", icon: Tv, roles: ["manager", "user"] as const },
  { to: "/activity-status", label: "Activity Status", icon: Activity, roles: ["manager", "user"] as const },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["manager"] as const },
  { to: "/profile", label: "Profile", icon: UserIcon, roles: ["manager", "user"] as const },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { role } = useRole();
  const userRole = role?.role ?? null;

  const logout = async () => {
    const userEmail = user?.email;
    const userId = user?.id;
    (supabase as any)
      .from("activity_logs")
      .insert({
        action: "user_logout",
        description: `User logged out: ${userEmail ?? "Unknown"}`,
        user_id: userId ?? null,
        user_name: userEmail?.split("@")[0] ?? "Unknown",
        user_role: userRole,
      })
      .then(() => {})
      .catch(() => {});
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/login");
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const links = allLinks.filter((l) => (l.roles as readonly string[]).includes(userRole ?? ""));

  return (
    <div className="min-h-screen flex flex-row">
      <aside className="w-20 sm:w-56 md:w-64 min-h-screen glass border-r p-3 sm:p-4 md:p-6 flex flex-col gap-4 md:gap-6 sticky top-0 z-30 shrink-0">
        <div className="flex items-center justify-between">
          <Logo />
        </div>
        {userRole && (
          <div className="flex justify-start">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-3 w-3" />
              {userRole}
            </span>
          </div>
        )}
        <nav className="flex flex-col gap-1 mt-4">
          {links.map(({ to, label, icon: Icon, end }) => (
            <div key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center justify-center sm:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
                    isActive
                      ? "bg-primary/15 text-primary shadow-glow-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                {to === "/profile" && profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-primary/40"
                  />
                ) : to === "/profile" ? (
                  <span className="h-5 w-5 shrink-0 rounded-full bg-primary/15 grid place-items-center text-[10px] font-semibold text-primary">
                    {initials}
                  </span>
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="justify-center sm:justify-start gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 grid-bg">
        <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
    </div>
  );
};
