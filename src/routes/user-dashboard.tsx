import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import UserDashboard from "@/pages/UserDashboard";

export const Route = createFileRoute("/user-dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="user">
      <UserDashboard />
    </ProtectedRoute>
  ),
});
