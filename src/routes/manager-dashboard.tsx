import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ManagerDashboard from "@/pages/ManagerDashboard";

export const Route = createFileRoute("/manager-dashboard")({
  head: () => ({ meta: [{ title: "Manager Dashboard — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <ManagerDashboard />
    </ProtectedRoute>
  ),
});
