import { useEffect, useRef, type ReactElement } from "react";
import { useNavigate } from "@/lib/router-shim";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Loader2 } from "lucide-react";

type Props = {
  children: ReactElement;
  requiredRole?: "manager" | "user";
};

export const ProtectedRoute = ({ children, requiredRole }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session && !redirectedRef.current) {
          redirectedRef.current = true;
          navigate("/login", { replace: true });
        }
      });
      return;
    }

    if (requiredRole && !roleLoading && role && role.role !== requiredRole) {
      redirectedRef.current = true;
      navigate(role.role === "manager" ? "/manager-dashboard" : "/user-dashboard", { replace: true });
    }
  }, [user, authLoading, role, roleLoading, requiredRole, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiredRole && roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiredRole && role && role.role !== requiredRole) {
    return null;
  }

  return children;
};
