import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Settings from "@/pages/Settings";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <Settings />
    </ProtectedRoute>
  ),
});
