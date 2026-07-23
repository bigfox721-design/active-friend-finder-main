import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@/lib/router-shim";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useRole } from "@/hooks/useRole";
import { Loader2 } from "lucide-react";

function IndexRedirect() {
  const { role, loading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role?.role === "manager") {
      navigate("/manager-dashboard", { replace: true });
    } else {
      navigate("/user-dashboard", { replace: true });
    }
  }, [role, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Branch Keeper" }],
  }),
  component: () => (
    <ProtectedRoute>
      <IndexRedirect />
    </ProtectedRoute>
  ),
});
